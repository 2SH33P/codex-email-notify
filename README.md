# Codex Email Notify

Languages: [English](./README.md) | [简体中文](./README.zh-CN.md)

This local Codex plugin uses a Node.js notifier to send an email whenever Codex finishes a task.

## Documentation

- [Chinese README](./README.zh-CN.md)
- [Chinese configuration guide](./docs/zh-CN/configuration.md)
- [Chinese usage guide](./docs/zh-CN/usage.md)
- [Chinese troubleshooting guide](./docs/zh-CN/troubleshooting.md)

## What it supports

- Codex native `notify` payloads via `~/.codex/config.toml`
- Codex `Stop` hook payloads via [`hooks.json`](./hooks.json)
- SMTP delivery through `nodemailer`
- De-duplication by `session_id + turn_id`, so enabling both `notify` and `Stop` will still only send one email per completed turn

## Files

- `.codex-plugin/plugin.json`: local plugin manifest
- `scripts/email-notify.mjs`: the notifier entrypoint
- `config.example.json`: example SMTP and recipient settings
- `hooks.json`: optional `Stop` hook wiring

## Configuration

Create `config.local.json` in this directory or set environment variables.

Environment variables:

- `CODEX_EMAIL_NOTIFY_TO`
- `CODEX_EMAIL_NOTIFY_FROM`
- `CODEX_EMAIL_NOTIFY_SUBJECT_PREFIX`
- `CODEX_EMAIL_NOTIFY_SMTP_HOST`
- `CODEX_EMAIL_NOTIFY_SMTP_PORT`
- `CODEX_EMAIL_NOTIFY_SMTP_SECURE`
- `CODEX_EMAIL_NOTIFY_SMTP_USER`
- `CODEX_EMAIL_NOTIFY_SMTP_PASS`
- `CODEX_EMAIL_NOTIFY_DRY_RUN`
- `CODEX_EMAIL_NOTIFY_STATE_DIR`

Example local config:

```json
{
  "to": ["you@example.com"],
  "from": "codex@example.com",
  "subjectPrefix": "[Codex]",
  "smtp": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "user": "smtp-user@example.com",
    "pass": "app-password"
  }
}
```

## Required Codex Setup

You must register the notifier in your own `~/.codex/config.toml`.

Add:

```toml
notify = ["node", "/absolute/path/to/codex-email-notify/scripts/email-notify.mjs"]
```

Example for this repository layout:

```toml
notify = ["node", "/root/plugins/codex-email-notify/scripts/email-notify.mjs"]
```

Without this `notify` entry, Codex will not call the plugin after a task completes.

## Notify wiring

The current workspace is configured to call:

```toml
notify = ["node", "/root/plugins/codex-email-notify/scripts/email-notify.mjs"]
```

That makes Codex invoke the script after task completion through its native notifier pipeline.

## Optional hook mode

If you also enable hooks in `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

the bundled `hooks.json` can be used as a `Stop`-hook fallback. The notifier de-dupes repeated events for the same turn.

## Local test

Dry-run without sending email:

```bash
echo '{"event":"agent-turn-complete","session_id":"s1","turn_id":"t1","cwd":"/root","model":"gpt-5.4","input_messages":[{"role":"user","content":"run the tests"}],"last_assistant_message":"Tests passed."}' \
  | node /root/plugins/codex-email-notify/scripts/email-notify.mjs --dry-run
```
