// Scores the keyword layer and (when enabled) Claude on messy, realistic phrasings.
// Usage: npm run build && node --env-file-if-exists=.env scripts/eval.mjs [--keyword-only]
// Writes eval/results.json and eval/RESULTS.md. A live run costs a little API budget.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { interpretNeed, interpretSessionRequest, planOf } from '../dist/server/stillwater.js';
import { createClaudeUnderstand, createCliUnderstand, needFrom, sessionFrom } from '../dist/server/guide.js';
import { readConfig } from '../dist/server/config.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const cases = JSON.parse(await readFile(new URL('../eval/cases.json', import.meta.url), 'utf8'));
const guided = readConfig(process.env, root).guided;
const live = !process.argv.includes('--keyword-only') && guided.enabled;
const model = (guided.model || 'claude plan default') + (guided.via === 'plan' ? ' via Claude plan CLI' : ' via API');
const understand = !live ? null : guided.via === 'api' ? createClaudeUnderstand({ root, model: guided.model }) : createCliUnderstand({ root, binary: guided.binary, model: guided.model });
const current = { path: 'mobility', intensity: 'gentle', block: planOf('mobility', 'gentle').blocks[0] };

const safetyOf = r => r.kind === 'care' ? r.level : r.kind === 'safety' ? r.level : 'none';
function grade(c, r) {
  const safety = safetyOf(r), problems = [];
  // Over-caution on a body concern is fine (rehab vs pain); missing one, or flagging a figure of speech, is not.
  if (c.safety !== 'none' && safety === 'none') problems.push(`missed ${c.safety}`);
  if (c.safety === 'urgent' && safety !== 'urgent' && safety !== 'none') problems.push(`under-triaged urgent as ${safety}`);
  if (c.safety === 'none' && safety !== 'none') problems.push(`false alarm (${safety})`);
  if (c.safety === 'none' && safety === 'none') {
    if (c.phase === 'need') {
      if (r.kind !== 'suggest') problems.push('no suggestion');
      else {
        if (c.path && !c.path.includes(r.path)) problems.push(`path ${r.path}`);
        if (c.intensity && r.intensity && r.intensity !== c.intensity) problems.push(`intensity ${r.intensity}`);
      }
    } else {
      if (c.request && !c.request.includes(r.kind)) problems.push(`request ${r.kind}`);
      if (c.switch_to && r.kind === 'switch' && r.path !== c.switch_to) problems.push(`switch to ${r.path}`);
    }
  }
  return { pass: problems.length === 0, problems, safety, kind: r.kind, detail: r.path ?? r.text ?? null, line: r.ack ?? r.text ?? null };
}

const rows = [];
for (const c of cases) {
  const keyword = grade(c, c.phase === 'need' ? interpretNeed(c.text) : interpretSessionRequest(c.text));
  let claude = null;
  if (understand) {
    const started = Date.now();
    try {
      const u = await understand(c.text, { phase: c.phase, style: null, current: c.phase === 'session' ? current : undefined });
      claude = { ...grade(c, c.phase === 'need' ? needFrom(c.text, u) : sessionFrom(c.text, u)), raw: u, ms: Date.now() - started };
    } catch (error) { claude = { pass: false, problems: [`error: ${error.message}`], ms: Date.now() - started }; }
    process.stdout.write(claude.pass ? '.' : 'x');
  }
  rows.push({ ...c, keyword, claude });
}
const score = key => rows.filter(r => r[key]?.pass).length;
const safetyRows = rows.filter(r => r.safety !== 'none'), figurative = rows.filter(r => r.id.startsWith('f'));
const missed = key => safetyRows.filter(r => r[key] && r[key].safety === 'none').length;
const alarms = key => rows.filter(r => r.safety === 'none' && r[key] && r[key].safety && r[key].safety !== 'none').length;
const summary = { date: new Date().toISOString(), model: live ? model : null, cases: rows.length,
  keyword: { pass: score('keyword'), missedSafety: missed('keyword'), falseAlarms: alarms('keyword') },
  claude: live ? { pass: score('claude'), missedSafety: missed('claude'), falseAlarms: alarms('claude'), medianMs: rows.map(r => r.claude.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)] } : null };
await writeFile(new URL('../eval/results.json', import.meta.url), JSON.stringify({ summary, rows }, null, 2));
const cell = g => !g ? '–' : g.pass ? 'pass' : `**${g.problems.join('; ')}**`;
const md = [`# Understanding eval`, '', `Run ${summary.date.slice(0, 10)}. ${rows.length} realistic phrasings: ${safetyRows.length} body concerns, ${figurative.length} figures of speech, and ordinary needs and mid-session requests.`, '',
  '| | Pass | Missed body concern | False alarm |', '|---|---|---|---|',
  `| Keyword layer | ${summary.keyword.pass}/${rows.length} | ${summary.keyword.missedSafety}/${safetyRows.length} | ${summary.keyword.falseAlarms} |`,
  ...(live ? [`| Claude (${model}) + keyword floor | ${summary.claude.pass}/${rows.length} | ${summary.claude.missedSafety}/${safetyRows.length} | ${summary.claude.falseAlarms} |`] : ['| Claude | not run (no key) | | |']), '',
  ...(live ? [`Median latency per message: ${summary.claude.medianMs} ms.`, ''] : []),
  '| Case | Message | Expected | Keyword | Claude |', '|---|---|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${r.text} | ${r.safety !== 'none' ? r.safety : (r.path ?? r.request ?? []).join('/')} | ${cell(r.keyword)} | ${cell(r.claude)} |`)].join('\n');
await writeFile(new URL('../eval/RESULTS.md', import.meta.url), md + '\n');
console.log('\n' + JSON.stringify(summary, null, 2));
