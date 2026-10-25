// Honest wording for what the local timers recorded. A timer is time on this
// page, never evidence of movement, and "Simulate finish" is not a timed run.
import type { TimerListEntry } from './timer-store.js';

export type RecapEntry = Pick<TimerListEntry, 'label' | 'seconds' | 'remaining' | 'status'> & { early: boolean; reset?: boolean; safety?: boolean };
const clock = (seconds: number) => { const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function recapLine(entry: RecapEntry): string {
  if (entry.status === 'done') return entry.early ? 'marked finished with Simulate finish, not timed' : `ran the full ${clock(entry.seconds)}`;
  if (entry.status === 'running') return `still running, ${clock(entry.remaining)} left`;
  if (entry.status === 'paused') return entry.safety ? `paused for safety with ${clock(entry.remaining)} left` : `paused with ${clock(entry.remaining)} left`;
  return entry.reset ? 'reset, not run again' : 'not started';
}

export function recapSummary(entries: RecapEntry[]): string {
  if (!entries.length) return 'No timers in this run.';
  const full = entries.filter(e => e.status === 'done' && !e.early).length;
  const early = entries.filter(e => e.status === 'done' && e.early).length;
  const safety = entries.filter(e => e.status === 'paused' && e.safety).length;
  const open = entries.filter(e => e.status === 'running' || e.status === 'paused' && !e.safety).length;
  const skipped = entries.filter(e => e.status === 'stopped' && !e.reset).length;
  const reset = entries.filter(e => e.status === 'stopped' && e.reset).length;
  const parts = [`${full} of ${entries.length} timers ran to zero`];
  if (early) parts.push(`${early} marked finished early`);
  if (safety) parts.push(`${safety} paused for safety`);
  if (open) parts.push(`${open} still open`);
  if (reset) parts.push(`${reset} reset`);
  if (skipped) parts.push(`${skipped} not started`);
  return parts.join(' · ') + '.';
}
