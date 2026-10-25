// Scripted Stillwater content for Mock: onboarding screens, profile tone and the
// simulated sessions. Everything leaves here as declarative OpenUI statements.
import { serializeStatement as statement } from '../shared/openui/serialize.js';
import type { ScreenDocument } from '../shared/openui/document.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import { VOCABULARY } from './vocabulary.js';

export type Style = 'beginner' | 'regular' | 'challenge' | 'exploring';
export type Path = 'mobility' | 'stretching' | 'cardio';
export type Intensity = 'gentle' | 'steady';
export type StillwaterContext = { name: string; style: Style | null; term?: string | null; need?: string | null };
export type Block = { key: string; title: string; label: string; seconds: number; text: string; steps: string[]; cue: string; transition?: boolean };

export const STYLES: Style[] = ['beginner', 'regular', 'challenge', 'exploring'];
export const STYLE_LABELS: Record<Style, string> = { beginner: 'Beginner', regular: 'Regular', challenge: 'Challenge seeker', exploring: 'Just exploring' };
export const PATHS: Path[] = ['mobility', 'stretching', 'cardio'];
export const PATH_NAMES: Record<Path, string> = { mobility: 'Mobility reset', stretching: 'Stretch and settle', cardio: 'Low-impact cardio' };
const PATH_LABELS: Record<Path, string> = { mobility: 'Mobility', stretching: 'Stretching', cardio: 'Cardio' };
const INTENSITY_LABELS: Record<Intensity, string> = { gentle: 'Gentle', steady: 'Steady' };
// Two short steps before movement: who you are (optional) and what today needs.
export const ONBOARDING = ['hey', 'mood', 'intensity'] as const;
export type OnboardingStep = typeof ONBOARDING[number];

// Stillwater's voice: warm, observant only about what the reader chose, lightly playful, calm.
// She speaks at a few moments (arrival, choices, first block, last block, closing) and
// stays quiet in between. She never claims to see effort, feelings or bodies.
// Profile sets the voice only. It never picks the path or the intensity.
type Tone = { ack: string; hint: string; opener: string; nudge: string; picked: Record<Intensity, string>; closing: string; again: string };
const TONES: Record<Style | 'neutral', Tone> = {
  beginner: { ack: 'Beginner it is. Plain words, small steps, and I’ll say what each screen is for.', hint: 'Not sure? Gentle is a comfortable first pick, but it’s your call.', opener: 'We will take this one block at a time. Each timer waits for you, and Back is always there.', nudge: 'There’s no wrong pace here.', picked: { gentle: 'A calm first pass. Good choice for finding your feet.', steady: 'Steady it is. Every step stays clear, and Back is always there.' }, closing: 'First sessions are mostly about finding your way around, and you did. Nothing here needed to be perfect.', again: 'Whenever you feel like it, we can repeat this one or try {other}. It gets more familiar every time.' },
  regular: { ack: 'Regular, got it. I’ll keep it brief and the cues useful.', hint: 'Pick what fits how today feels, not your usual routine.', opener: 'Here is the plan. Start each timer when you’re set.', nudge: 'Smooth reps, steady breath.', picked: { gentle: 'A lighter day. Those count too.', steady: 'Steady. Clean reps, steady breath.' }, closing: 'Short and to the point. A fair use of a few minutes.', again: 'Next time, {other} would balance today out. Or come back to this one; both work.' },
  challenge: { ack: 'Challenge seeker, noted. I’ll bring precision, not hype, and you still choose the session.', hint: 'Being a challenge seeker doesn’t lock you into Steady. Gentle is a valid choice today.', opener: 'The challenge today is control, not speed.', nudge: 'Make each rep a little cleaner than the last.', picked: { gentle: 'Gentle is a smart call. Precision is the challenge today.', steady: 'Steady. Control over speed, every block.' }, closing: 'You chose control over speed today. That’s the harder thing to practise.', again: 'Another day, try {other} with the same focus on control.' },
  exploring: { ack: 'Just exploring, perfect. No commitment needed; we’ll see what feels interesting.', hint: 'Either is a fine way to explore. Gentle is shorter; Steady shows a little more.', opener: 'Treat this as a tour. Notice which block you would want again.', nudge: 'Notice what this one feels like for you.', picked: { gentle: 'The short tour. Notice what you like.', steady: 'The longer tour, with one extra block to explore.' }, closing: 'Now you know what this one is like. That was the whole point.', again: 'Curious next time? Try {other}; it shows a different side.' },
  neutral: { ack: 'Let’s find something that fits today.', hint: 'Choose whichever suits today.', opener: 'Start each timer when you’re ready. Back is always available.', nudge: 'Move in a range that feels comfortable.', picked: { gentle: 'Ready when you are.', steady: 'Ready when you are.' }, closing: 'That’s the session.', again: 'Another day, {other} makes a nice counterpart. No rush.' },
};
const tone = (ctx: StillwaterContext) => TONES[ctx.style ?? 'neutral'];
export const ackFor = (style: Style) => TONES[style].ack;
export const pickedFor = (ctx: StillwaterContext, intensity: Intensity) => tone(ctx).picked[intensity];
/** What each path is about, said once when it is chosen. */
export const PATH_REPLY: Record<Path, string> = { mobility: 'Mobility: slow, controlled range. No forcing.', stretching: 'Stretching: mild tension, held calmly.', cardio: 'Low-impact cardio: rhythm, not jumps. One foot always stays down.' };
// The ending, per path: a settling title, what today made room for (the plan, never a claimed
// result), an optional closing breath, a spoken goodbye, and a gentle counterpart for another day.
const NEED_RAIL: Partial<Record<NeedKind, string>> = { sitting: 'for a break from sitting', stiff: 'for stiffness', legs: 'for tight legs', time: 'for a short window', low: 'kept light', restless: 'for restless energy', energetic: 'with more rhythm', calm: 'to unwind', unsure: 'an easy start', fitness: 'for general fitness' };
const NEED_INTRO: Partial<Record<NeedKind, string>> = { sitting: 'Built for a break from sitting.', stiff: 'Built around easing stiffness.', legs: 'Built for tight legs.', time: 'Built to fit a short window.', low: 'Kept light for a low-energy day.', restless: 'Built to give restless energy somewhere to go.', energetic: 'Built with a bit more rhythm.', calm: 'Built to be quiet.', unsure: 'An easy place to start.', fitness: 'General movement for being a bit more active.' };
const NEED_CLOSE: Partial<Record<NeedKind, string>> = { sitting: 'A small break from all that sitting.', stiff: 'Slow, easy range for the stiffness you mentioned.', legs: 'A calm stretch for those tight legs.', time: 'Short, and still worth making room for.', low: 'Kept light, the way you wanted.', restless: 'Somewhere for that restless energy to go.', energetic: 'More rhythm, like you were after.', calm: 'A quieter few minutes, like you wanted.', unsure: 'A simple place to start.', fitness: 'One more small piece of being active.' };
const ANOTHER_DAY: Record<Path, string> = { mobility: 'a mobility reset', stretching: 'some stretching', cardio: 'a little low-impact cardio' };
const ENDINGS: Record<Path, { settle: string; room: Record<Intensity, string>; breath: string; spoken: string; other: Path }> = {
  mobility: { settle: 'Let that settle.', room: { gentle: 'A few unhurried minutes for your spine, shoulders and hips.', steady: 'A steadier round for the spine, shoulders and hips, with one extra flow.' }, breath: 'If you like, one slow breath before you move on. No need to hurry back.', spoken: 'There. Give it a moment before you rush back into everything else.', other: 'stretching' },
  stretching: { settle: 'Stay here a moment.', room: { gentle: 'A quiet stretch for the neck, chest and the backs of the legs.', steady: 'A fuller stretch, from a moving warm-up to the backs of the legs.' }, breath: 'If you like, one long exhale with soft shoulders before the rest of your day.', spoken: 'That’s it. Let the quiet last a little longer, if you can.', other: 'mobility' },
  cardio: { settle: 'Let the pace come all the way down.', room: { gentle: 'Some easy, low-impact rhythm to get moving.', steady: 'Two low-impact intervals, with easy marching on either side.' }, breath: 'If you like, walk slowly for a few breaths before you sit down. There’s no hurry.', spoken: 'That was the last one. Ease off the pace before the next thing.', other: 'stretching' },
};
const named = (ctx: StillwaterContext, sentence: string) => ctx.name ? `${ctx.name}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}` : sentence;

// `transition` marks easy recovery blocks: they use the name, not the effort nudge.
// Gentle: four shorter timed blocks. Steady: five longer blocks, including one extra active block.
const PLANS: Record<Path, Record<Intensity, Block[]>> = {
  mobility: {
    gentle: [
      { key: 'spine', title: 'Wake the spine', label: 'Cat-cow or seated spine waves', seconds: 40, text: 'Move between a gently rounded back and a lifted chest. Keep the motion smooth, small and easy to repeat.', steps: ['Breathe in as the chest opens.', 'Breathe out as the back rounds.', 'Let the neck follow without forcing it.'], cue: 'Start the timer when you’re ready. Nothing needs pushing.' },
      { key: 'shoulders', title: 'Shoulders and neck', label: 'Slow shoulder circles', seconds: 45, text: 'Make slow shoulder circles, then reverse direction halfway through. Keep the neck long.', steps: ['Circle forward, up, back and down.', 'Make the circle smaller if anything feels sharp.', 'Let each exhale lower the shoulders.'], cue: 'Let the shoulders move without bracing.' },
      { key: 'breathe', title: 'Downshift', label: 'Easy breathing reset', seconds: 30, text: 'A pause between blocks. Let each exhale be a little longer than the inhale.', steps: ['Stand or sit comfortably.', 'Breathe in through the nose if that is comfortable.', 'Notice what has changed so far.'], cue: 'One quieter breath, then another.', transition: true },
      { key: 'hips', title: 'Hip hinge reach', label: 'Hip hinge reach', seconds: 45, text: 'Stand tall, soften the knees and hinge slightly at the hips as the arms reach forward, then return to standing.', steps: ['Keep the back long rather than chasing depth.', 'Press the feet into the floor to stand.', 'Reach only as far as you can return from smoothly.'], cue: 'The return matters more than the reach.' },
    ],
    steady: [
      { key: 'spine', title: 'Spine CARs', label: 'Slow spine waves with rotation', seconds: 50, text: 'Round, lengthen and gently rotate through the upper back. Keep the motion smooth enough to repeat.', steps: ['Breathe in into length.', 'Breathe out into the curve.', 'Turn only as far as stays comfortable.'], cue: 'Slow is the point here.' },
      { key: 'shoulders', title: 'Shoulder control', label: 'Shoulder circles and reaches', seconds: 55, text: 'Circle the shoulders, then reach forward and draw the elbows back. Keep the ribs quiet.', steps: ['Reverse direction halfway through.', 'Pause for a breath when the shoulders drop.', 'Make each rep a little cleaner.'], cue: 'Own the range before you add more.' },
      { key: 'flow', title: 'Squat-to-reach flow', label: 'Shallow squat and overhead reach', seconds: 45, text: 'Sit the hips back a little, stand tall, then reach overhead. Keep it shallow if that feels better.', steps: ['Feet stay grounded.', 'Stand fully before you reach.', 'Keep the breath moving.'], cue: 'A little more warmth, still under control.' },
      { key: 'breathe', title: 'Reset the pace', label: 'Standing breath reset', seconds: 35, text: 'Let the breath settle before the final block. Longer exhales help the next movement stay smooth.', steps: ['Soften the shoulders.', 'Lengthen each exhale.', 'Start the last block only when ready.'], cue: 'Downshift enough to finish well.', transition: true },
      { key: 'hips', title: 'Hip hinge reach', label: 'Hip hinge with forward reach', seconds: 55, text: 'Hinge slightly, reach forward, then return to standing with control. Keep the back long.', steps: ['Soft knees.', 'Reach only as far as you can return from smoothly.', 'Press the feet into the floor to stand.'], cue: 'Last focused block. Smooth return over depth.' },
    ],
  },
  stretching: {
    gentle: [
      { key: 'neck', title: 'Neck side stretch', label: 'Easy neck side stretch', seconds: 40, text: 'Sit or stand tall and let one ear drift toward the same shoulder. Switch sides halfway.', steps: ['Keep both shoulders relaxed and low.', 'Mild tension only; no pulling with the hand.', 'Return to centre slowly before switching.'], cue: 'Let gravity do the work.' },
      { key: 'chest', title: 'Chest opener', label: 'Hands-behind chest opener', seconds: 40, text: 'Rest the hands on the lower back or clasp them loosely behind you, then gently lift the chest.', steps: ['Draw the shoulders back, not up.', 'Keep breathing slowly.', 'Ease off if the shoulders pinch.'], cue: 'Open the front of the body, one breath at a time.' },
      { key: 'settle', title: 'Settle', label: 'Slow breathing', seconds: 30, text: 'A pause between stretches. Let the breath slow down by itself.', steps: ['Soften the jaw.', 'Lengthen each exhale.', 'Notice what feels looser.'], cue: 'Nothing to do but breathe.', transition: true },
      { key: 'legs', title: 'Back of the legs', label: 'Seated forward reach', seconds: 40, text: 'Sit near the front of a sturdy chair with one leg straight out, heel on the floor. Hinge forward from the hips until you feel a mild stretch. Switch legs halfway.', steps: ['Lead with the chest, not the head.', 'Mild stretch, never sharp.', 'Keep both hips facing forward.'], cue: 'Hinge, don’t hunch.' },
    ],
    steady: [
      { key: 'warm', title: 'Dynamic warm-up', label: 'Arm swings and gentle torso turns', seconds: 45, text: 'Swing the arms loosely and turn the upper body side to side. Moving stretches like this prepare you for the held ones.', steps: ['Keep the swings relaxed, not forced.', 'Let the head turn with the torso.', 'Keep the knees soft.'], cue: 'Moving first, holding later.' },
      { key: 'neck', title: 'Neck and upper back', label: 'Side neck stretch, then upper-back round', seconds: 50, text: 'Ease one ear toward the shoulder on each side, then round the upper back as if hugging a large ball.', steps: ['Shoulders stay low.', 'Breathe into the back of the ribs.', 'Mild tension only.'], cue: 'Create space without forcing it.' },
      { key: 'hipflexor', title: 'Front of the hips', label: 'Standing hip flexor stretch', seconds: 50, text: 'Take a comfortable split stance, tuck the hips slightly under and shift forward until the front of the back hip feels a mild stretch. Switch sides halfway.', steps: ['Hold a wall or chair for balance if useful.', 'Keep the torso tall.', 'A small shift is enough.'], cue: 'Tall and tucked. Small is enough.' },
      { key: 'settle', title: 'Settle', label: 'Slow breathing', seconds: 30, text: 'A pause before the last stretch. Let the breath slow down by itself.', steps: ['Soften the jaw.', 'Lengthen each exhale.', 'Notice what feels looser.'], cue: 'Nothing to do but breathe.', transition: true },
      { key: 'legs', title: 'Back of the legs', label: 'Standing hamstring stretch', seconds: 50, text: 'Place one heel slightly forward with the toes up, soften the other knee and hinge forward from the hips. Switch legs halfway.', steps: ['Hands rest on the bent leg, not the straight knee.', 'Keep the back long.', 'Mild stretch, never sharp.'], cue: 'Hinge from the hips and keep the back long.' },
    ],
  },
  cardio: {
    gentle: [
      { key: 'warm', title: 'Warm-up march', label: 'Easy march in place', seconds: 45, text: 'March in place at a relaxed pace and let the arms swing naturally.', steps: ['Keep one foot on the ground at all times.', 'Breathing should stay easy.', 'Talk test: full sentences should feel easy.'], cue: 'Start smaller than you think.' },
      { key: 'steptouch', title: 'Step-touch', label: 'Side step-touch', seconds: 45, text: 'Step one foot out to the side, bring the other to meet it, and repeat side to side.', steps: ['Light on your feet; no jumping.', 'Add easy arm swings if that feels good.', 'Keep a pace you could talk at.'], cue: 'Find a rhythm you could chat through.' },
      { key: 'recover', title: 'Recover', label: 'Walk it out', seconds: 30, text: 'Slow the march right down and let your breathing settle.', steps: ['Smaller steps.', 'Longer exhales.', 'Shoulders relaxed.'], cue: 'Let the breath come back to you.', transition: true },
      { key: 'cool', title: 'Cool-down', label: 'Slow march with long exhales', seconds: 30, text: 'Keep marching slowly and make each exhale a little longer.', steps: ['Slow, even steps.', 'Let the arms hang loose.', 'Notice the breath settling.'], cue: 'Easy finish.', transition: true },
    ],
    steady: [
      { key: 'warm', title: 'Warm-up march', label: 'Easy march in place', seconds: 45, text: 'March in place at a relaxed pace and let the arms swing naturally.', steps: ['Keep one foot on the ground at all times.', 'Breathing should stay easy.', 'Talk test: full sentences should feel easy.'], cue: 'Start smaller than you think.' },
      { key: 'interval1', title: 'Interval 1', label: 'Step-touch with arm reach', seconds: 60, text: 'Step side to side and reach the arms overhead as you step. Rhythmic and low impact.', steps: ['One foot always grounded.', 'Talk test: short sentences should still be possible.', 'Slow down whenever breathing feels too hard.'], cue: 'Rhythm over speed.' },
      { key: 'recover', title: 'Recover', label: 'Easy march', seconds: 30, text: 'Bring the pace down to an easy march between intervals.', steps: ['Smaller steps.', 'Longer exhales.', 'Shoulders relaxed.'], cue: 'Recover before the next one.', transition: true },
      { key: 'interval2', title: 'Interval 2', label: 'Low knee lifts', seconds: 60, text: 'March with slightly higher knees at a pace that stays comfortable.', steps: ['Lift only as high as feels easy.', 'Stand tall.', 'Keep a steady rhythm.'], cue: 'Steady and tall. Comfortable effort only.' },
      { key: 'cool', title: 'Cool-down', label: 'Slow march with long exhales', seconds: 45, text: 'Keep marching slowly and make each exhale a little longer.', steps: ['Slow, even steps.', 'Let the arms hang loose.', 'Notice the breath settling.'], cue: 'Easy finish.', transition: true },
    ],
  },
};

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
export function planOf(path: Path, intensity: Intensity): { blocks: Block[]; total: number } {
  const blocks = PLANS[path][intensity];
  return { blocks, total: blocks.reduce((sum, block) => sum + block.seconds, 0) };
}
const screen = (key: string, children: string[]) => `${key} = Screen([${children.join(', ')}])`;
const list = (key: string, items: string[]) => [`${key} = List([${items.map((_, i) => `${key}_${i + 1}`).join(', ')}])`, ...items.map((item, i) => statement(`${key}_${i + 1}`, 'ListItem', [item]))];
const profile = (key: string, ctx: StillwaterContext) => statement(key, 'Profile', ctx.style ? [ctx.name, ctx.style] : [ctx.name]);
/** Reveal `step` after the onboarding screens already present (a session may start mid-way, e.g. from home). */
export const revealRootIn = (existing: string[], step: OnboardingStep) => { const order = ONBOARDING.filter(k => existing.includes(k) || k === step); return `root = Screens([${order.slice(0, order.indexOf(step) + 1).join(', ')}], ${step})`; };
export const revealRoot = (step: OnboardingStep) => `root = Screens([${ONBOARDING.slice(0, ONBOARDING.indexOf(step) + 1).join(', ')}], ${step})`;

export const NAME_HINT = 'Optional, and only used in this run. Prefer not to say? Skip it.';
export function heyProgram() {
  return [revealRoot('hey'), screen('hey', ['hey_word', 'hey_title', 'hey_text', 'name_field', 'name_note', 'name_actions', 'hey_cue']),
    statement('hey_word', 'Keyword', ['HEY', 'Stillwater is here']),
    statement('hey_title', 'Text', ['I’m Stillwater. What should I call you?', 'title']),
    statement('hey_text', 'Text', ['A few easy minutes, shaped around what today needs. One question after this, then we move.', 'description']),
    statement('name_field', 'NameInput', ['Your first name', 'e.g. Sam']),
    statement('name_note', 'Text', [NAME_HINT, 'body']),
    statement('name_actions', 'FollowUps', [['Skip the name']]),
    statement('hey_cue', 'Cue', ['Hey. No pressure, no performance. Just a few good minutes.']),
  ].join('\n');
}
// Each session teaches one word for something it actually contains, shown at the end.
const SESSION_WORDS: Record<Path, Record<Intensity, { term: string; block: string }[]>> = {
  mobility: { gentle: [{ term: 'Hip hinge', block: 'hips' }, { term: 'ROM', block: 'shoulders' }], steady: [{ term: 'CARs', block: 'spine' }, { term: 'Hip hinge', block: 'hips' }, { term: 'Tempo', block: 'shoulders' }] },
  stretching: { gentle: [{ term: 'Static stretching', block: 'neck' }, { term: 'Hip hinge', block: 'legs' }], steady: [{ term: 'Dynamic stretching', block: 'warm' }, { term: 'Static stretching', block: 'legs' }] },
  cardio: { gentle: [{ term: 'Talk test', block: 'steptouch' }, { term: 'Low impact', block: 'warm' }, { term: 'Cool-down', block: 'cool' }], steady: [{ term: 'Talk test', block: 'interval1' }, { term: 'Warm-up', block: 'warm' }, { term: 'RPE', block: 'interval2' }] },
};
/** The word for this session; `turn` rotates through its options so repeat sessions teach something new. */
export const sessionWord = (path: Path, intensity: Intensity, turn = 0) => { const options = SESSION_WORDS[path][intensity]; return options[((turn % options.length) + options.length) % options.length].term; };
function wordStatements(path: Path, intensity: Intensity, chosen: string) {
  // After a mid-session switch the chosen word may not belong to the new plan: use one that does.
  const options = SESSION_WORDS[path][intensity], link = options.find(w => w.term === chosen) ?? options[0], term = link.term;
  const entry = VOCABULARY.find(v => v.term === term);
  const block = PLANS[path][intensity].find(b => b.key === link?.block);
  if (!entry || !block) return null;
  return [statement('finish_word', 'Keyword', [entry.term, entry.expansion ?? 'A word from today']),
    statement('finish_word_text', 'Text', [`You met this in “${block.title}”. ${entry.meaning}`, 'body'])];
}
export function moodStatements(ctx: StillwaterContext, note = 'Tap one, or tell me what today needs.') {
  return [screen('mood', ['mood_ack', 'mood_you', 'mood_title', 'mood_text', 'mood_actions', 'mood_ask', 'mood_cue']),
    statement('mood_ack', 'Text', [ctx.name ? `Good to meet you, ${ctx.name}.` : tone(ctx).ack, 'body']),
    profile('mood_you', ctx),
    statement('mood_title', 'Text', ['What are you in the mood for today?', 'title']),
    statement('mood_text', 'Text', [note, 'description']),
    statement('mood_actions', 'FollowUps', [PATHS.map(path => PATH_LABELS[path])]),
    statement('mood_ask', 'TextInput', ['Or in your own words', 'e.g. I’ve been sitting all day']),
    statement('mood_cue', 'Cue', ['Choose what you actually want today, not what you think you should do.']),
  ];
}
export type NeedContext = { heard: NeedKind[]; ack: string; intensity: Intensity | null };
export function intensityStatements(ctx: StillwaterContext, path: Path, need?: NeedContext) {
  const gentle = planOf(path, 'gentle'), steady = planOf(path, 'steady');
  const levels: Intensity[] = need?.intensity === 'steady' ? ['steady', 'gentle'] : ['gentle', 'steady'];
  const option = (level: Intensity) => `${INTENSITY_LABELS[level]} ${PATH_LABELS[path].toLowerCase()} · ${clock(planOf(path, level).total)}${need?.intensity === level ? ' (suggested)' : ''}`;
  return [screen('intensity', ['intensity_title', ...(need ? ['intensity_need'] : []), 'intensity_you', 'intensity_text', 'intensity_hint', 'intensity_actions', 'intensity_cue']),
    ...(need ? [statement('intensity_need', 'Text', [`Heard: ${need.heard.map(k => HEARD[k]).join(' · ')}`, 'subtitle'])] : []),
    statement('intensity_title', 'Text', [need ? `How about ${need.intensity ? `${need.intensity} ${PATH_LABELS[path].toLowerCase()}` : ANOTHER_DAY[path]}?` : `${PATH_NAMES[path]}: how much today?`, 'title']),
    profile('intensity_you', ctx),
    statement('intensity_text', 'Text', [`Gentle is ${gentle.blocks.length} blocks. Steady is ${steady.blocks.length}, with longer timers and one extra active block.`, 'description']),
    statement('intensity_hint', 'Text', [need ? need.ack : tone(ctx).hint, 'body']),
    statement('intensity_actions', 'FollowUps', [[...levels.map(option), ...(need ? ['Something else'] : [])]]),
    statement('intensity_cue', 'Cue', ['Intensity changes the structure: how many blocks and how long each timer runs.']),
  ];
}

export function sessionProgram(path: Path, intensity: Intensity, ctx: StillwaterContext, cursor = 'intro') {
  const { blocks, total } = planOf(path, intensity), t = tone(ctx), n = blocks.length;
  const title = `${INTENSITY_LABELS[intensity]} · ${PATH_NAMES[path]}`;
  const lines = [`root = Screens([intro, ${blocks.map(b => b.key).join(', ')}, finish], ${cursor})`];
  const intro = ['intro_title', ...(ctx.name || ctx.style ? ['intro_you'] : []), 'intro_text', 'intro_plan', 'intro_note', 'intro_cue'];
  lines.push(screen('intro', intro), statement('intro_title', 'Text', [title, 'title']));
  if (ctx.name || ctx.style) lines.push(profile('intro_you', ctx));
  lines.push(statement('intro_text', 'Text', [`${ctx.need && NEED_INTRO[ctx.need as NeedKind] ? NEED_INTRO[ctx.need as NeedKind] + ' ' : ''}${n} blocks · ${clock(total)} on the timers. Rest between blocks as long as you like.`, 'description']),
    ...list('intro_plan', blocks.map(b => `${b.title} · ${clock(b.seconds)}`)),
    statement('intro_note', 'Alert', ['info', 'Simulated session: Stillwater cannot see you. Do only what feels comfortable.']),
    statement('intro_cue', 'Cue', [named(ctx, t.opener)]));
  const lastActive = blocks.map(b => !b.transition).lastIndexOf(true);
  // The rail keeps the session's intention in view on every movement, in a few words.
  const railIntent = `${INTENSITY_LABELS[intensity]} ${PATH_LABELS[path].toLowerCase()}${ctx.need && NEED_RAIL[ctx.need as NeedKind] ? ` · ${NEED_RAIL[ctx.need as NeedKind]}` : ''}`;
  blocks.forEach((b, i) => {
    lines.push(screen(b.key, blockChildren(b.key)),
      statement(`${b.key}_ask`, 'TextInput', ['Something changed? Tell Stillwater', 'e.g. this is too easy']),
      statement(`${b.key}_rail`, 'Rail', [railIntent, blocks[i + 1]?.title ?? 'Wind down']),
      statement(`${b.key}_title`, 'Text', [`${i + 1} of ${n} · ${b.title}`, 'title']),
      statement(`${b.key}_timer`, 'Timer', [b.label, b.seconds]),
      statement(`${b.key}_text`, 'Text', [b.text, 'description']),
      ...list(`${b.key}_steps`, b.steps),
      statement(`${b.key}_cue`, 'Cue', [i === 0 ? `${b.cue} ${t.nudge}` : i === lastActive ? `Last active block. ${b.cue}` : b.cue]));
  });
  // The ending leads with closure; the timer record stays available but secondary.
  const ending = ENDINGS[path], word = ctx.term ? wordStatements(path, intensity, ctx.term) : null;
  lines.push(screen('finish', ['finish_title', 'finish_text', ...(word ? ['finish_word', 'finish_word_text'] : []), 'finish_breath', 'finish_again', 'finish_recap', 'finish_cue']),
    statement('finish_title', 'Text', [ending.settle, 'title']),
    statement('finish_text', 'Text', [`${ctx.need && NEED_CLOSE[ctx.need as NeedKind] ? NEED_CLOSE[ctx.need as NeedKind] : ending.room[intensity]} ${t.closing}`, 'description']),
    ...(word ?? []),
    statement('finish_breath', 'Text', [ending.breath, 'body']),
    statement('finish_again', 'Text', [t.again.replace('{other}', ANOTHER_DAY[ending.other]), 'body']),
    statement('finish_recap', 'Recap', [`What the timers recorded · ${clock(total)} planned`]),
    statement('finish_cue', 'Cue', [`${ending.spoken} I’m glad we made a little room for this${ctx.name ? `, ${ctx.name}` : ''}.`]));
  return lines.join('\n');
}

// Reading context back from the echoed document.
const childrenOf = (s: StatementNode) => s.props.children as StatementNode[];
export function readContext(doc: ScreenDocument): StillwaterContext {
  const found = doc.screens.flatMap(childrenOf).filter(node => node.name === 'Profile').at(-1);
  const style = found?.props.style;
  return { name: typeof found?.props.name === 'string' ? found.props.name : '', style: STYLES.includes(style as Style) ? style as Style : null };
}
export function readVocabTerm(doc: ScreenDocument): string | null {
  const node = doc.screens.flatMap(childrenOf).find(n => n.key === 'vocab_word');
  return typeof node?.props.text === 'string' ? node.props.text : null;
}
export function readOfferedPath(doc: ScreenDocument): Path | null {
  const node = doc.screens.flatMap(childrenOf).find(n => n.key === 'intensity_actions');
  return detectPath(((node?.props.prompts as string[] | undefined) ?? []).join(' '));
}
export const isOnboarding = (doc: ScreenDocument) => (ONBOARDING as readonly string[]).includes(doc.screens[0]?.key ?? '');

// Intent parsing: one clear match wins; anything ambiguous is asked about.
const single = <T extends string>(text: string, patterns: Record<T, RegExp>): T | null => {
  const hits = (Object.keys(patterns) as T[]).filter(key => patterns[key].test(text.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
};
export const detectPath = (text: string) => single<Path>(text, { mobility: /\bmobility\b|\bjoints?\b|\bstiff/, stretching: /\bstretch/, cardio: /\bcardio\b|\bheart rate\b|\bget moving\b|\bmarch/ });
export const detectIntensity = (text: string) => single<Intensity>(text, { gentle: /\bgentle\b|\beasy\b|\blight\b|\bshort(er)?\b|\bcalm\b/, steady: /\bsteady\b|\bharder\b|\blonger\b|\bmore\b/ });
export const detectStyle = (text: string) => single<Style>(text, { beginner: /\bbeginner\b|\bnew to\b/, regular: /\bregular\b/, challenge: /\bchallenge/, exploring: /\bexplor/ });

const NOT_NAMES = new Set(['next', 'back', 'skip', 'continue', 'ok', 'okay', 'yes', 'no', 'start', 'begin', 'hi', 'hello', 'hey', 'help', 'stop', 'reset', 'finish', 'done', 'menu']);
const NOT_AFTER_IM = new Set(['fine', 'good', 'ok', 'okay', 'great', 'ready', 'here', 'back', 'tired', 'new', 'not', 'just', 'a', 'so', 'very', 'doing', 'feeling', 'sure', 'me', 'going', 'in', 'on', 'the', 'still', 'excited', 'nervous']);
export type NameResult = { kind: 'name'; name: string } | { kind: 'ambiguous'; word: string } | { kind: 'unclear' };
const NAME_WORD = /^\p{L}[\p{L}'’-]{0,23}$/u;
const tidy = (word: string) => word === word.toUpperCase() ? word.charAt(0) + word.slice(1).toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1);
/** Reads a first name from free text without treating commands as names. */
export function parseName(raw: string): NameResult {
  const text = raw.trim().replace(/[.!?]+$/, '').replace(/^(?:hi|hello|hey)(?:\s+there)?\s*[,!-]?\s*/i, '').trim();
  const explicit = text.match(/(?:^|\b)(?:my name is|my name[’']s|name[’']s|call me|i am|i[’']m|im|it[’']s|it is|this is)\s+(\p{L}[\p{L}'’-]*)/iu);
  if (explicit) {
    const word = explicit[1]; const strong = /my name|name[’']s|call me/i.test(explicit[0]);
    if (!strong && NOT_AFTER_IM.has(word.toLowerCase())) return { kind: 'unclear' };
    if (!NAME_WORD.test(word)) return { kind: 'unclear' };
    // "My name is Mary Anne" (the name field's form) keeps a capitalised second word.
    const rest = text.slice((explicit.index ?? 0) + explicit[0].length).trim();
    const second = /^my name is$/i.test(explicit[0].replace(/\s+\S+$/, '').trim()) && /^\p{Lu}[\p{L}'’-]*$/u.test(rest) ? rest : '';
    return { kind: 'name', name: second ? `${tidy(word)} ${second}` : tidy(word) };
  }
  const words = text.replace(/[,;:]+/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 3 || !words.every(word => NAME_WORD.test(word))) return { kind: 'unclear' };
  if (NOT_NAMES.has(words[0].toLowerCase())) return { kind: 'ambiguous', word: tidy(words[0]) };
  return { kind: 'name', name: tidy(words[0]) };
}

// Free-text needs on the discovery screen. Small, deterministic and local: normalised text is
// matched against intent categories that map onto the existing paths and intensities. It is not
// model reasoning, and Stillwater only reflects the meaning of what was said, never more.
export type NeedKind = 'sitting' | 'stiff' | 'legs' | 'time' | 'low' | 'restless' | 'energetic' | 'calm' | 'unsure' | 'fitness';
export type Need =
  | { kind: 'suggest'; path: Path; intensity: Intensity | null; ack: string; plain: boolean; heard: NeedKind[] }
  | { kind: 'clarify'; ack: string }
  | { kind: 'care'; level: 'urgent' | 'pain' | 'rehab'; ack: string };
const INTENTS = {
  urgent: ['chest pain', 'chest hurts', 'chest feels tight', 'cannot breathe', 'short of breath', 'trouble breathing', 'struggling to breathe', 'faint', 'fainted', 'fainting', 'blacked out', 'passed out', 'numb', 'numbness', 'severe pain', 'sudden pain'],
  rehab: ['rehab', 'rehabilitation', 'recovering from', 'recovery from', 'post op', 'after surgery', 'surgery', 'physio', 'physiotherapy', 'physical therapy'],
  pain: ['pain', 'painful', 'dizzy', 'dizziness', 'lightheaded', 'light headed', 'nauseous', 'nausea', 'feel sick', 'feeling sick', 'felt sick', 'cramp', 'something feels wrong', 'hurt', 'hurts', 'hurting', 'injury', 'injured', 'sprain', 'sprained', 'strain', 'strained', 'torn', 'broken', 'fracture', 'swollen', 'sore knee', 'bad back', 'pulled a muscle'],
  outside: ['run', 'running', 'jog', 'jogging', 'weights', 'lift', 'lifting', 'dumbbell', 'dumbbells', 'barbell', 'swim', 'swimming', 'cycling', 'bike', 'hiit', 'jump', 'jumping', 'push ups', 'pushups', 'sit ups', 'situps', 'sprint', 'sprints'],
  fitness: ['lose weight', 'weight loss', 'losing weight', 'burn calories', 'burn fat', 'fat burning', 'calories', 'slim down', 'get fit', 'fit', 'fitness', 'fitter', 'get in shape', 'stamina', 'endurance', 'more active', 'tone up'],
  sitting: ['sitting', 'sat', 'not moved', 'sedentary', 'couch', 'sofa', 'desk', 'computer', 'laptop', 'screen all day', 'office', 'commute', 'long drive', 'long flight'],
  stiff: ['stiff', 'stiffness', 'tight', 'tightness', 'tense', 'achy', 'knots', 'hunched', 'locked up', 'loosen', 'creaky'],
  legs: ['leg', 'legs', 'hamstring', 'hamstrings', 'calf', 'calves', 'thighs'],
  time: ['quick', 'short on time', 'in a hurry', 'no time', 'not much time', 'busy', 'few minutes', 'couple of minutes', 'something short'],
  low: ['tired', 'exhausted', 'drained', 'sluggish', 'sleepy', 'no energy', 'low energy', 'low on energy', 'worn out', 'wiped', 'burnt out', 'burned out', 'foggy', 'fried', 'knackered'],
  restless: ['restless', 'fidgety', 'antsy', 'wired', 'pent up', 'cannot sit still', 'stir crazy', 'need to move', 'itching to move'],
  energetic: ['energetic', 'energised', 'energized', 'get moving', 'sweat', 'sweaty', 'harder', 'intense', 'heart rate', 'heart pumping', 'wake me up', 'pumped', 'motivated', 'challenge', 'push myself'],
  calm: ['reset', 'need a break', 'calm', 'unwind', 'relax', 'decompress', 'wind down', 'de stress', 'destress', 'stressed', 'overwhelmed', 'quiet'],
  unsure: ['do not know', 'not sure', 'no idea', 'whatever', 'anything', 'surprise me', 'you choose', 'you pick', 'you decide', 'up to you', 'get started', 'help me start', 'where to start', 'where to begin', 'feels right'],
} as const;
type Intent = keyof typeof INTENTS;
const PATTERNS = Object.fromEntries(Object.entries(INTENTS).map(([k, words]) => [k, new RegExp(`(?:^| )(?:${(words as readonly string[]).join('|')})(?= |$)`)])) as Record<Intent, RegExp>;
/** Lower-case, straight apostrophes, contractions expanded, punctuation dropped. */
export function normalise(raw: string) {
  return raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/\bcan't\b/g, 'cannot').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not')
    .replace(/\bi'm\b/g, 'i am').replace(/\bi've\b/g, 'i have').replace(/'s\b/g, ' is').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
// What Stillwater heard, in its words (shown on the decision screen), and how it says so in a reply.
export const HEARD: Record<NeedKind, string> = { sitting: 'a lot of sitting', stiff: 'some stiffness', legs: 'tight legs', time: 'not much time', low: 'low energy', restless: 'restless energy', energetic: 'wanting more energy', calm: 'wanting something calm', unsure: 'not sure where to start', fitness: 'general fitness' };
const NEED_ACK: Record<NeedKind, string> = {
  fitness: 'I can help with general movement and fitness. A few minutes here isn’t a weight-loss plan, but movement you enjoy is a good thing to build on.',
  legs: 'Tight legs: a calm stretch for the backs of the legs fits.',
  sitting: 'After a lot of sitting, slow movement for the back and hips is a good fit.',
  stiff: 'For stiffness, slow and controlled range fits well.',
  time: 'Short on time is fine; every gentle session here is under three minutes on the timers.',
  low: 'Low on energy, so let’s keep it light.',
  restless: 'Restless energy does well with a bit of rhythm.',
  energetic: 'Something with more rhythm, then.',
  calm: 'Something quieter, then.',
  unsure: 'No need to know. Let’s start somewhere easy.',
};
const ORDER: NeedKind[] = ['fitness', 'legs', 'sitting', 'stiff', 'time', 'low', 'restless', 'energetic', 'calm', 'unsure'];
export const CARE_ACK = {
  urgent: 'That sounds like it needs urgent medical attention, not exercise. Please stop and contact your local emergency number or urgent care now.',
  pain: 'I can’t assess pain or injuries, so I won’t pick a session around it. Getting advice from a doctor or physiotherapist before exercising that area is the safe call.',
  rehab: 'If you’re recovering, your clinician’s advice and restrictions come first. These sessions aren’t a rehab plan.',
};
// Idioms that name pain without describing the body are removed before matching.
const IDIOMS = / ?\b(a |such a |what a )?pain in the (neck|backside|butt|bum|arse|ass)\b/g;
export function interpretNeed(raw: string): Need {
  const t = normalise(raw).replace(IDIOMS, ' ').trim(), on = (k: Intent) => PATTERNS[k].test(t), explicit = detectPath(t);
  // Safety first, even when mixed with an ordinary request: never route pain into a workout.
  if (on('urgent')) return { kind: 'care', level: 'urgent', ack: CARE_ACK.urgent };
  if (on('rehab')) return { kind: 'care', level: 'rehab', ack: CARE_ACK.rehab };
  if (on('pain')) return { kind: 'care', level: 'pain', ack: CARE_ACK.pain };
  const heard = ORDER.filter(k => k === 'time' ? on('time') || /\b\d+ ?(min|mins|minute|minutes)\b|\b(one|two|three|four|five|ten) (min|mins|minute|minutes)\b/.test(t) : on(k));
  const has = (k: NeedKind) => heard.includes(k), outside = on('outside') && !explicit;
  if (has('low') && (has('energetic') || has('restless'))) return { kind: 'clarify', ack: 'Low on energy but wanting something lively? Which matters more today: easy, or a bit more energetic?' };
  const path: Path | null = explicit ?? (outside || has('energetic') || has('fitness') || has('restless') ? 'cardio' : has('legs') && (has('stiff') || has('sitting')) ? 'stretching' : has('sitting') || has('stiff') ? 'mobility' : has('calm') || has('low') ? 'stretching' : has('unsure') || has('time') ? 'mobility' : null);
  if (!path) return { kind: 'clarify', ack: 'Tell me a little more: loosen up, stretch out, or get moving a bit? Or tap mobility, stretching or cardio.' };
  const intensity: Intensity | null = has('time') || has('low') || has('unsure') || has('calm') ? 'gentle' : has('energetic') || outside ? 'steady' : detectIntensity(t);
  const kinds = heard.filter(k => k !== 'legs' || has('stiff') || has('sitting'));
  const lines = [...(outside ? ['Running, weights and jumping are outside what I can guide here; these sessions are short and equipment-free.'] : []), ...kinds.map(k => NEED_ACK[k])];
  if (!lines.length) return { kind: 'suggest', path, intensity, ack: PATH_REPLY[path], plain: true, heard: [] };
  const pick = intensity ? `${INTENSITY_LABELS[intensity].toLowerCase()} ${PATH_LABELS[path].toLowerCase()} (${clock(planOf(path, intensity).total)})` : ANOTHER_DAY[path];
  return { kind: 'suggest', path, intensity, ack: `${lines.slice(0, 2).join(' ')} I’d suggest ${outside ? 'the closest fit, ' : ''}${pick}.`, plain: false, heard: kinds };
}
export const readHeard = (text: string): NeedKind[] => (Object.keys(HEARD) as NeedKind[]).filter(k => text.includes(HEARD[k]));

/** Care replaces the choices on the discovery screen: no session is offered around pain. */
export function careStatements(level: 'urgent' | 'pain' | 'rehab' | 'rest' | 'rest-urgent') {
  const urgent = level === 'urgent' || level === 'rest-urgent', rest = level.startsWith('rest');
  if (rest) return [screen('mood', ['care_title', 'care_text', ...(urgent ? [] : ['care_actions']), 'care_cue']),
    statement('care_title', 'Text', [urgent ? 'Please look after that first.' : 'That’s a good call.', 'title']),
    statement('care_text', 'Text', [urgent ? 'Get help now. Stillwater will be here another time, when you’re ready.' : 'Look after yourself. If you change your mind, the session choices are still here.', 'description']),
    ...(urgent ? [] : [statement('care_actions', 'FollowUps', [['Show the session choices']])]),
    statement('care_cue', 'Cue', ['Take care.'])];
  return [screen('mood', ['care_title', 'care_alert', 'care_text', 'care_actions', 'care_cue']),
    statement('care_title', 'Text', [urgent ? 'Please get help first.' : 'Let’s not work around pain.', 'title']),
    statement('care_alert', 'Alert', [urgent ? 'danger' : 'warning', CARE_ACK[level as 'urgent' | 'pain' | 'rehab']]),
    statement('care_text', 'Text', [urgent ? 'This isn’t something I can help with, and it isn’t a time to exercise.' : 'If you’d still like to move today, choose something that leaves that area alone, and stop if anything hurts.', 'description']),
    statement('care_actions', 'FollowUps', [urgent ? ['I understand'] : ['Not today', 'Show the session choices']]),
    statement('care_cue', 'Cue', [urgent ? 'Please look after yourself first.' : 'No pressure either way.'])];
}
export const careLevel = (doc: ScreenDocument) => { const node = doc.screens.flatMap(childrenOf).find(n => n.key === 'care_alert' || n.key === 'care_title'); if (!node) return null; const alert = doc.screens.flatMap(childrenOf).find(n => n.key === 'care_alert'); return alert ? (alert.props.tone === 'danger' ? 'urgent' : 'pain') : (doc.screens.flatMap(childrenOf).some(n => n.key === 'care_actions') ? 'rest' : 'rest-urgent'); };

// In-session: the reader can tell Stillwater something changed. Safety always wins; every other
// change is offered and waits for an explicit yes. Nothing restarts the journey or a timer.
export const blockChildren = (key: string) => [`${key}_rail`, `${key}_title`, `${key}_text`, `${key}_timer`, `${key}_steps`, `${key}_ask`, `${key}_cue`];
export type SessionRequest = { kind: 'safety'; level: 'urgent' | 'pain' | 'rehab' } | { kind: 'harder' | 'easier' | 'stop' | 'unclear' } | { kind: 'switch'; path: Path | null } | { kind: 'tip'; text: string };
export function interpretSessionRequest(raw: string): SessionRequest {
  const need = interpretNeed(raw);
  if (need.kind === 'care') return { kind: 'safety', level: need.level };
  const t = normalise(raw), path = detectPath(t);
  if (/\b(stop|quit|end( it| the session)?|finish|enough|call it)\b|\bi am done\b/.test(t)) return { kind: 'stop' };
  if (/\bswitch|\bchange|something else|\bdifferent\b|\bswap\b/.test(t) || path) return { kind: 'switch', path };
  if (/too easy|harder|step it up|push (me|myself)|more (challeng|intense)|bit more|not enough/.test(t)) return { kind: 'harder' };
  if (/too (hard|intense|much|fast)|easier|slow (it )?down|lighter|gentler|tone it down|less/.test(t)) return { kind: 'easier' };
  return { kind: 'unclear' };
}
/** The current session as the document shows it: path, intensity and the context it was built with. */
export function readSession(doc: ScreenDocument) {
  const nodes = doc.screens.flatMap(childrenOf), text = (key: string) => String(nodes.find(n => n.key === key)?.props.text ?? '');
  const title = text('intro_title'), path = PATHS.find(p => title.endsWith(PATH_NAMES[p])), intensity = (['gentle', 'steady'] as Intensity[]).find(l => title.startsWith(INTENSITY_LABELS[l]));
  if (!path || !intensity) return null;
  const intro = text('intro_text'), need = (Object.keys(NEED_INTRO) as NeedKind[]).find(k => intro.startsWith(NEED_INTRO[k]!)) ?? null;
  const term = text('finish_word') || null;
  return { path, intensity, ctx: { ...readContext(doc), term, need } as StillwaterContext };
}
/** An offer sits on top of the current block until the reader answers it. */
export function offerStatements(key: string, text: string, actions: string[]) {
  return [screen(key, ['offer_note', 'offer_actions', ...blockChildren(key)]), statement('offer_note', 'Alert', ['info', text]), statement('offer_actions', 'FollowUps', [actions])];
}
/** Safety replaces the block's content; the timer stays in the document (paused by the client) but out of view. */
export function safetyStatements(key: string, level: 'urgent' | 'pain' | 'rehab') {
  const urgent = level === 'urgent';
  return [screen(key, ['safety_title', 'safety_alert', 'safety_text', 'safety_actions', `${key}_timer`, 'safety_cue']),
    statement('safety_title', 'Text', [urgent ? 'Stop here and get help.' : 'Let’s stop and rest.', 'title']),
    statement('safety_alert', 'Alert', [urgent ? 'danger' : 'warning', urgent ? CARE_ACK.urgent : 'I’ve paused the timer. I can’t tell what’s causing this, so please don’t push through it. If it’s severe, or comes with chest pain or trouble breathing, get urgent medical help.']),
    statement('safety_text', 'Text', [urgent ? 'Don’t continue this session.' : 'Take a break. You don’t need to finish the rest of the session, and I won’t suggest another movement in its place.', 'description']),
    statement('safety_actions', 'FollowUps', [urgent ? ['End the session'] : ['End the session', 'I’ve rested and feel okay']]),
    statement('safety_cue', 'Cue', [urgent ? 'Please look after yourself first.' : 'No pressure. Stopping is a perfectly good choice.'])];
}
/** Closing after stopping early or for safety: the same calm room, honest about why it ended. */
export function earlyFinishStatements(safety: boolean) {
  return [statement('finish_title', 'Text', [safety ? 'Let’s leave it there.' : 'That’s enough for today.', 'title']),
    statement('finish_text', 'Text', [safety ? 'Stopping was the right call. Take it easy, and if it doesn’t settle, check in with a doctor or physiotherapist.' : 'Stopping early is fine. A few minutes of movement still made room for something.', 'description']),
    ...(safety ? [statement('finish_breath', 'Text', ['Rest for as long as you need.', 'body']), statement('finish_again', 'Text', ['Come back whenever you feel ready. There’s no rush.', 'body'])] : []),
    statement('finish_cue', 'Cue', [safety ? 'Take care of yourself.' : 'Whenever you feel like it, we’ll pick up from something that fits.'])];
}
