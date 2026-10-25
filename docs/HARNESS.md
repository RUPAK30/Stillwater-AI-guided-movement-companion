# Architecture and origin

## Origin

Stillwater was built on top of a **starter harness provided for a take-home product exercise**. The starter supplied the plumbing:
- the OpenUI parser and screen document;
- base component signatures, validation and the timer ledger;
- run navigation and event phrasing;
- the local HTTP server with optional model adapters;
- a generic wiring sample.

Files carrying the comment *"Adapted from a starter harness provided for a take-home exercise"* come from that starter, and remain its authors' work.

The product layer, its components and its behaviour were designed and built on top of that starter:
- onboarding;
- intent and safety handling;
- sessions, the workout stage, adaptation and endings;
- the colour system;
- the behaviour specification (`skills/workout.md`) and the tests for all of the above.

## How a turn works

1. The browser sends `messages` (a recent window; earlier replies as words only), the current screen as `ui_state`, and queued `client_events` such as timer changes or navigation.
2. The server answers with a `reply`: conversation text plus complete ` ```openui ` fences.
   - In Mock, `src/server/mock.ts` routes the turn: onboarding steps, in-session requests, safety.
   - With a live provider, a model produces the reply, guided by `prompts/` and `skills/workout.md`.
3. The server validates the reply against the current screen. If a reply has words but an invalid screen update, the words are kept and the current screen stays.
4. The browser applies the reply. Named statements persist; repeating a name replaces it. The document compacts superseded lines so long sessions stay within limits.

## Components

The base catalogue (Screens, Screen, Text, Keyword, List, ListItem, Alert, Timer, Cue, FollowUps) is extended through three seams:
- the library: `openui-library.ts`;
- validators: `validate.ts`;
- renderers: `src/web/components.ts`.

| Component | Purpose |
| --- | --- |
| `Profile(name, style?)` | Visible "about you" chip. Also carries the run's context in `ui_state`. |
| `Recap(title?)` | Live, honest record of every timer: ran, ended early, reset, paused for safety, not started. |
| `NameInput(label?, placeholder?)` | Validated name field. Sends "My name is …". |
| `TextInput(label?, placeholder?)` | Free-text field for needs and in-session requests. |
| `Rail(intent, next?)` | The session's intention and the next movement, on every movement screen. |

Any screen containing a Timer is composed by `renderWorkout()` in `src/web/app.ts` into one workout stage:
- a header with the session and progress;
- the movement stage, with the dial timer;
- the companion area;
- an Up next card;
- session navigation.

## Safety and honesty rules (enforced in code and tests)

- Pain, injury, rehab or dizziness never route into a workout.
- A safety notice on a movement pauses its running timer and locks navigation until the user chooses.
- Changes to intensity or activity are offered and applied only after confirmation.
- Durations shown always equal the sum of the timers. Reaching the end is never reported as a completed workout.
