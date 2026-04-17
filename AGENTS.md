# Repository Guidelines

## Project Structure & Module Organization

This repository is a small Codex plugin, not a multi-package app. Keep changes focused and local.

- `scripts/email-notify.mjs`: main Node.js entrypoint for parsing Codex payloads, de-duplicating events, and sending SMTP mail.
- `.codex-plugin/plugin.json`: plugin manifest and UI metadata.
- `hooks.json`: optional `Stop` hook wiring for Codex.
- `config.example.json`: sample SMTP configuration shape.
- `README.md`, `README.zh-CN.md`, `docs/zh-CN/`: user-facing docs. Update docs when behavior or config changes.
- `package.json`: runtime metadata and npm scripts.

Do not edit `node_modules/`; treat it as generated content.

## Build, Test, and Development Commands

- `npm install`: install `nodemailer` and refresh `package-lock.json`.
- `npm run test:dry-run`: run the notifier in dry-run mode without sending mail.
- `echo '{"event":"agent-turn-complete",...}' | node scripts/email-notify.mjs --dry-run`: preferred realistic smoke test for payload parsing.

There is no build step. This project runs directly on Node.js `>=20`.

## Coding Style & Naming Conventions

- Use ES modules, 2-space indentation, semicolons, and double quotes, matching `scripts/email-notify.mjs`.
- Prefer small pure helpers for payload parsing and formatting.
- Keep filenames lowercase with hyphens where needed; keep config keys and JSON field names stable.
- Avoid adding dependencies unless the current Node standard library is insufficient.

## Testing Guidelines

There is no formal automated test suite yet. Every behavior change should include:

- at least one dry-run command that exercises the new path
- an example payload in the PR description or commit notes
- manual verification that no real email is sent during tests unless explicitly intended

If you add automated tests, place them under `tests/` and prefer Node’s built-in test runner over heavier frameworks.

## Commit & Pull Request Guidelines

Current history uses short, imperative commit subjects, for example: `Initial commit: Codex email notify plugin`. Follow that style and keep subjects concise.

PRs should include:

- purpose and scope
- affected files or config fields
- dry-run verification steps and output summary
- doc updates in both English and Chinese when user-facing behavior changes

## Security & Configuration Tips

Never commit `config.local.json`, SMTP passwords, personal access tokens, or real recipient addresses. Use `config.example.json` for examples and environment variables for secrets.
