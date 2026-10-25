# Runtime setup

Every browser session starts in Mock. Selecting a provider alone does not invoke it. A live request needs local enablement, provider selection, usage consent and Send or Retry. There is no automatic provider fallback.

## Claude (guided), recommended

Claude reads what you type: needs before a session, and safety concerns and requests during one. It returns a schema-checked interpretation (structured outputs, `skills/guide.md`). Stillwater's trusted local code still draws every screen, so the model never writes UI, durations or safety wording.

- **Safety floor.** The keyword layer always runs too. Claude can raise a concern ("my knee feels weird" → pain) but never lower one the keywords found.
- **Guarded words.** The model's sentence is shown only if it's short, makes no duration claim, and has no exclamation marks, links or markup. Otherwise the scripted wording is used.
- **Fallback.** If the API fails, the keyword layer answers and the reply says so.
- Only free text goes to the model. Button taps and commands never do.

Two ways to run it:

- **Your Claude plan (Pro or Max).** Set `ALLOW_CLAUDE_PLAN=true`. Stillwater runs the official `claude` CLI (or `CLAUDE_CLI_PATH`) with your existing login: `claude -p --json-schema …` with no tools, no settings, no saved session, an empty temporary working directory, the message passed on stdin, and no API keys in its environment. It works on Windows, macOS and Linux. Each typed message takes a few seconds and counts toward your plan's usage limits.
- **An API key.** Set `ALLOW_CLAUDE_API=true` and `ANTHROPIC_API_KEY` (optionally `ANTHROPIC_MODEL`, default `claude-opus-5-5`). This uses the Anthropic SDK directly and takes priority when both are set.

Then restart, choose **Claude (guided)** and consent before sending. `npm run eval` scores the keyword layer and Claude on 44 realistic phrasings and writes `eval/RESULTS.md`.

## OpenAIAPI

Copy `.env.example` to `.env`. Set `ALLOW_LIVE_API=true`, add a permitted `OPENAI_API_KEY`, and set `OPENAI_MODEL` to a model available to your account. Restart the app, select OpenAIAPI and consent to usage before sending. Keys stay on the server. This adapter uses the Responses endpoint with a structured reply envelope.

## ClaudeCLI

This adapter requires an installed official `claude` executable and an existing Claude-plan login. The restricted runner supports macOS and Linux only; on Windows it is rejected before any request. The implementation requires Claude Code 2.1.211 or later within major version 2, and checks its required flags and login before each request. Unsupported installations are rejected.

In `.env`, set `ALLOW_CLAUDE_CLI=true`, `CLAUDE_CLI_PATH` to the absolute executable path, and `CLI_PROFILE_ACKNOWLEDGED=true` after reviewing the restrictions below. `CLAUDE_MODEL` may be blank to use the CLI default. Restart, select ClaudeCLI and consent before sending. The app does not install the CLI or perform login.

The runner disables action tools, user MCP configuration, slash commands, browser integration and session persistence. It checks reported tools and rejects unexpected tool activity. These restrictions are not an operating-system sandbox; managed host policy or hooks may still apply. Review the host before enabling this mode. Auth files and tokens are not extracted by the app.

## CodexCLI

The in-app response runtime is disabled because its required restriction profile has not been verified. Codex can still be used separately as a coding tool.

## Verification status

The adapter tests use fake transports. No live OpenAI or subscription CLI model request has been verified for this release. Actual account access, model behavior and usage costs need a live check with permitted credentials. Cancelling locally may not prevent usage for a request already accepted by a provider.
