// Curated fitness vocabulary: each session ends with one of these terms. Plain-English, general
// definitions only: no medical claims, no personal prescriptions.
export type VocabTerm = { term: string; expansion: string | null; category: 'mobility' | 'stretching' | 'cardio' | 'recovery' | 'technique'; meaning: string; notice: string };

// Ordered so neighbouring terms come from different categories; the picker walks this order.
export const VOCABULARY: readonly VocabTerm[] = [
  { term: 'CARs', expansion: 'Controlled articular rotations', category: 'mobility', meaning: 'Slow, deliberate circles of one joint through the range you can control. The point is quality of movement, not size.', notice: 'Move slowly enough to feel where the circle gets harder.' },
  { term: 'Talk test', expansion: null, category: 'cardio', meaning: 'A simple check for cardio effort: if you can still speak in full sentences, the pace is easy to moderate.', notice: 'Try saying a full sentence out loud during an active block.' },
  { term: 'Static stretching', expansion: null, category: 'stretching', meaning: 'Holding a comfortable stretch position for a while, often used when cooling down.', notice: 'A stretch should feel like mild tension, never sharp.' },
  { term: 'DOMS', expansion: 'Delayed-onset muscle soreness', category: 'recovery', meaning: 'Muscle soreness that can show up a day or two after new or unfamiliar exercise.', notice: 'It is common after something new, and it usually fades by itself.' },
  { term: 'ROM', expansion: 'Range of motion', category: 'mobility', meaning: 'How far a joint can move. Comfortable range you can control is more useful than the biggest possible range.', notice: 'Stay in the part of the range you can return from smoothly.' },
  { term: 'Low impact', expansion: null, category: 'cardio', meaning: 'Movement where at least one foot stays on the ground, such as marching instead of jumping.', notice: 'Both cardio options here are low impact.' },
  { term: 'Dynamic stretching', expansion: null, category: 'stretching', meaning: 'Moving in and out of a stretch instead of holding still, like arm swings. Common in warm-ups.', notice: 'Keep it smooth rather than bouncy.' },
  { term: 'Cool-down', expansion: null, category: 'recovery', meaning: 'Easy movement at the end of a session that lets your breathing settle back toward normal.', notice: 'Longer exhales are a simple way to downshift.' },
  { term: 'RPE', expansion: 'Rating of perceived exertion', category: 'technique', meaning: 'A 1 to 10 scale of how hard an effort feels to you right now. 1 is resting; 10 is all-out.', notice: 'Everything in this demo is meant to sit at the easy end of the scale.' },
  { term: 'Hip hinge', expansion: null, category: 'technique', meaning: 'Bending forward from the hips while keeping your back long, like closing a drawer with your hips.', notice: 'Soft knees, long back, hips travel backward.' },
  { term: 'Warm-up', expansion: null, category: 'cardio', meaning: 'A few minutes of easier movement that gets you ready for the main work by gradually raising your breathing.', notice: 'Start smaller than you think you need to.' },
  { term: 'Active recovery', expansion: null, category: 'recovery', meaning: 'Light, easy movement on a lower-effort day, such as walking or gentle mobility.', notice: 'Easy days are part of training too.' },
  { term: 'Tempo', expansion: null, category: 'technique', meaning: 'How fast you move through each part of an exercise, such as taking three seconds to lower.', notice: 'Slower tempo makes a simple move more deliberate.' },
];
