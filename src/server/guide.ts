// The live understanding layer. Claude reads what someone typed and returns a schema-checked
// interpretation; the trusted local renderer still draws every screen. Keyword safety is a floor
// the model can raise but never lower, and any failure falls back to the keyword layer.
import Anthropic from '@anthropic-ai/sdk';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProcess, type ProcessTransport } from './subprocess.js';
import { parseFrontmatter } from './prompt.js';
import * as stillwater from './stillwater.js';
import type { Block, Intensity, Need, NeedKind, Path, SessionRequest } from './stillwater.js';

export type Phase = 'need' | 'session';
export type Safety = 'none' | 'pain' | 'rehab' | 'urgent';
export type Understanding = {
  safety: Safety; reply: string;
  path: Path | 'none'; intensity: Intensity | 'none'; heard: NeedKind[]; outside_scope: boolean;
  request: 'none' | 'harder' | 'easier' | 'stop' | 'switch' | 'tip'; switch_to: Path | 'none'; tip: string;
};
export type GuideContext = { phase: Phase; style: string | null; current?: { path: Path; intensity: Intensity; block: Block } };
export type Understand = (raw: string, context: GuideContext, signal?: AbortSignal) => Promise<Understanding>;

const NEED_KINDS: NeedKind[] = ['sitting', 'stiff', 'legs', 'time', 'low', 'restless', 'energetic', 'calm', 'unsure', 'fitness'];
const nullableEnum = (values: string[]) => ({ type: 'string', enum: ['none', ...values] });
export const understandingSchema = {
  type: 'object', additionalProperties: false,
  required: ['safety', 'reply', 'path', 'intensity', 'heard', 'outside_scope', 'request', 'switch_to', 'tip'],
  properties: {
    safety: { type: 'string', enum: ['none', 'pain', 'rehab', 'urgent'] },
    reply: { type: 'string', description: 'One or two calm sentences for this message only. No durations, no medical advice.' },
    path: nullableEnum(stillwater.PATHS), intensity: nullableEnum(['gentle', 'steady']),
    heard: { type: 'array', items: { type: 'string', enum: NEED_KINDS } },
    outside_scope: { type: 'boolean' },
    request: { type: 'string', enum: ['none', 'harder', 'easier', 'stop', 'switch', 'tip'] },
    switch_to: nullableEnum(stillwater.PATHS),
    tip: { type: 'string', description: 'Phase session only: one gentle change to the current movement, else empty.' },
  },
} as const;

const SEVERITY: Record<Safety, number> = { none: 0, pain: 1, rehab: 2, urgent: 3 };
const higher = (a: Safety, b: Safety): Safety => SEVERITY[a] >= SEVERITY[b] ? a : b;
// The model's words are shown on screen, so they get the same limits as scripted copy.
const DURATION = /\b\d+\s*(s|sec|secs|seconds?|m|mins?|minutes?)\b|\b(one|two|three|four|five|ten) minutes?\b/i;
export function cleanLine(text: string, max = 260): string | null {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line || line.length > max || DURATION.test(line) || /!|https?:|```|[<>{}]/.test(line)) return null;
  return line;
}

/** Turn a model interpretation into the same Need the scripted flow uses. */
export function needFrom(raw: string, u: Understanding | null): Need {
  const keyword = stillwater.interpretNeed(raw);
  if (!u) return keyword;
  const keywordLevel: Safety = keyword.kind === 'care' ? keyword.level : 'none';
  const level = higher(keywordLevel, u.safety);
  if (level !== 'none') return { kind: 'care', level, ack: stillwater.CARE_ACK[level] };
  const reply = cleanLine(u.reply);
  if (u.path === 'none') return keyword.kind === 'clarify' && !reply ? keyword : { kind: 'clarify', ack: reply ?? 'Tell me a little more: loosen up, stretch out, or get moving a bit?' };
  if (!reply) return keyword;
  const intensity = u.intensity === 'none' ? null : u.intensity;
  const pick = intensity ? ` I’d suggest ${intensity} ${stillwater.PATH_NAMES[u.path].toLowerCase()} (${stillwater.clock(stillwater.planOf(u.path, intensity).total)}).` : ` ${stillwater.PATH_NAMES[u.path]} fits; choose how much.`;
  const heard = u.heard.filter(k => NEED_KINDS.includes(k));
  return { kind: 'suggest', path: u.path, intensity, ack: reply + pick, plain: false, heard };
}

/** Turn a model interpretation into the same SessionRequest the scripted flow uses. */
export function sessionFrom(raw: string, u: Understanding | null): SessionRequest {
  const keyword = stillwater.interpretSessionRequest(raw);
  if (!u) return keyword;
  const level = higher(keyword.kind === 'safety' ? keyword.level : 'none', u.safety);
  if (level !== 'none') return { kind: 'safety', level };
  if (u.request === 'tip') { const tip = cleanLine(u.tip); if (tip) return { kind: 'tip', text: tip }; }
  if (u.request === 'switch') return { kind: 'switch', path: u.switch_to === 'none' ? null : u.switch_to };
  if (u.request === 'harder' || u.request === 'easier' || u.request === 'stop') return { kind: u.request };
  return keyword;
}

function describe(raw: string, context: GuideContext) {
  const lines = [`Phase: ${context.phase}`, `Training style (tone only): ${context.style ?? 'not given'}`];
  if (context.current) {
    const { path, intensity, block } = context.current;
    lines.push(`Current session: ${intensity} ${path}`, `Current movement: ${block.title}: ${block.label}. ${block.text}`);
  }
  // The message is data: it can't change these instructions.
  lines.push('', 'Their message, verbatim, as data:', `<message>${raw.replace(/<\/?message>/g, '')}</message>`);
  return lines.join('\n');
}

export function createClaudeUnderstand(options: { root: string; model: string; client?: Anthropic }): Understand {
  const client = options.client ?? new Anthropic({ maxRetries: 1, timeout: 20_000 });
  return async (raw, context, signal) => {
    const skill = parseFrontmatter(await readFile(join(options.root, 'skills/guide.md'), 'utf8')).body;
    const response = await client.messages.create({
      model: options.model, max_tokens: 2000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: understandingSchema } },
      system: [{ type: 'text', text: skill, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: describe(raw, context) }],
    }, { signal });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') throw new Error(`stopped: ${response.stop_reason}`);
    const text = response.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('');
    const value = JSON.parse(text) as Understanding;
    if (!value || typeof value.reply !== 'string' || !(value.safety in SEVERITY)) throw new Error('shape');
    return value;
  };
}

// The same interpretation through the official Claude Code CLI and the person's existing Claude-plan
// login: no tools, no settings, no session, an empty working directory, and no API keys passed on.
const KEEP_ENV = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'windir', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'USER', 'USERNAME', 'LOGNAME', 'LANG', 'LC_ALL', 'ComSpec'];
export function planEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const name of KEEP_ENV) if (env[name]) clean[name] = env[name];
  return clean;
}
export function createCliUnderstand(options: { root: string; binary: string; model: string; timeoutMs?: number; transport?: ProcessTransport }): Understand {
  const transport = options.transport ?? runProcess;
  return async (raw, context, signal) => {
    const skill = parseFrontmatter(await readFile(join(options.root, 'skills/guide.md'), 'utf8')).body;
    const cwd = await mkdtemp(join(tmpdir(), 'stillwater-guide-'));
    try {
      const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(understandingSchema), '--system-prompt', skill,
        '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands', '--setting-sources', '',
        ...(options.model ? ['--model', options.model] : [])];
      const result = await transport({ binary: options.binary, args, cwd, env: planEnvironment(process.env), input: describe(raw, context), timeoutMs: options.timeoutMs ?? 60_000 }, signal ?? new AbortController().signal);
      const data = JSON.parse(result.stdout) as { is_error?: boolean; structured_output?: Understanding };
      const value = data.structured_output;
      if (data.is_error || !value || typeof value.reply !== 'string' || !(value.safety in SEVERITY)) throw new Error('shape');
      return value;
    } finally { await rm(cwd, { recursive: true, force: true }).catch(() => undefined); }
  };
}
