import { CODEX_BLOCKER, type CliConfig } from './cli.js';
import type { ProviderStatus } from '../shared/contracts.js';

export type Config = { root: string; key: string; model: string; allowLive: boolean; claude: CliConfig; guided: { enabled: boolean; model: string; via: 'api' | 'plan'; binary: string } };
function model(value: string | undefined, fallback: string, name: string) {
  const result = value || fallback;
  if (result && !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(result)) throw new Error(`${name} must be an exact model ID or supported alias without flags or whitespace.`);
  return result;
}
// Claude (guided) runs through an API key when one is enabled, otherwise through the person's
// Claude-plan login in the official CLI. Either way it needs an explicit opt-in.
function guidedConfig(env: NodeJS.ProcessEnv): Config['guided'] {
  const api = env.ALLOW_CLAUDE_API === 'true' && Boolean(env.ANTHROPIC_API_KEY), plan = env.ALLOW_CLAUDE_PLAN === 'true';
  return { enabled: api || plan, via: api ? 'api' : 'plan', binary: env.CLAUDE_CLI_PATH || 'claude', model: model(env.ANTHROPIC_MODEL, api ? 'claude-opus-5-5' : '', 'ANTHROPIC_MODEL') };
}
export function readConfig(env: NodeJS.ProcessEnv, root: string): Config {
  if (env.APP_MODE && !['mock', 'live'].includes(env.APP_MODE)) throw new Error('Legacy APP_MODE must be mock or live; select the provider in the browser.');
  if (env.APP_MODE === 'live' && (env.ALLOW_LIVE_API !== 'true' || !env.OPENAI_API_KEY)) throw new Error('Live mode requires ALLOW_LIVE_API=true and OPENAI_API_KEY in your local environment.');
  const allowLive = env.ALLOW_LIVE_API === 'true';
  return { root, key: allowLive ? (env.OPENAI_API_KEY ?? '') : '', model: model(env.OPENAI_MODEL, 'gpt-6-luna', 'OPENAI_MODEL'), allowLive,
    guided: guidedConfig(env),
    claude: { enabled: env.ALLOW_CLAUDE_CLI === 'true', profileAcknowledged: env.CLI_PROFILE_ACKNOWLEDGED === 'true', binary: env.CLAUDE_CLI_PATH ?? '', model: model(env.CLAUDE_MODEL, '', 'CLAUDE_MODEL'), timeoutMs: 45_000 } };
}
export function providerStatuses(config: Config): ProviderStatus[] {
  const api = config.allowLive && Boolean(config.key);
  const cli = config.claude.enabled && config.claude.profileAcknowledged && Boolean(config.claude.binary);
  return [
    { id: 'mock', label: 'Mock', enabled: true, model: 'wiring-fixture-v1', message: 'Scripted local Stillwater flow and wiring fixture. Your skill is not evaluated by a model.' },
    { id: 'claude-guided', label: 'Claude (guided)', enabled: config.guided.enabled, model: config.guided.model || 'claude plan default', message: config.guided.enabled ? (config.guided.via === 'plan' ? 'Uses your Claude-plan login through the official CLI (counts toward plan limits; a few seconds per typed message). ' : '') + 'Claude reads what you type (needs, safety, mid-session requests); Stillwater still draws every screen. Keyword safety stays on as a floor. Typed messages are sent to Anthropic.' : 'Set ALLOW_CLAUDE_PLAN=true (uses your Claude plan via the CLI) or ALLOW_CLAUDE_API=true with ANTHROPIC_API_KEY in local .env, then restart. See docs/RUNTIMES.md.' },
    { id: 'openai-api', label: 'OpenAIAPI', enabled: api, model: config.model, message: api ? 'Uses your API budget when you send. Messages and skill are sent to OpenAI.' : 'Set ALLOW_LIVE_API=true and OPENAI_API_KEY in local .env, then restart. See README.' },
    { id: 'claude-cli', label: 'ClaudeCLI', enabled: cli, model: config.claude.model || 'claude-cli-default (unresolved)', message: cli ? 'Uses your Claude-plan login when you send. Restricted tool profile; managed host hooks may still run. CLI support/login are checked before each request.' : 'Set ALLOW_CLAUDE_CLI, CLAUDE_CLI_PATH and CLI_PROFILE_ACKNOWLEDGED in local .env. See docs/RUNTIMES.md.' },
    { id: 'codex-cli', label: 'CodexCLI', enabled: false, model: 'unresolved · execution blocked', message: CODEX_BLOCKER },
  ];
}
