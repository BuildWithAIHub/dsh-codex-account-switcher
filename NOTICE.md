# NOTICE

`dsh-codex-account-switcher` is an unofficial community plugin for DeepSeek
Harness (DSH). It is not affiliated with, endorsed by, or supported by OpenAI,
DeepSeek, or their affiliates.

Security-relevant behavior:

- The plugin reads and writes the Codex CLI's `auth.json` under `$CODEX_HOME`
  (default `~/.codex`). That file contains OAuth tokens.
- Snapshot accounts are full copies of `auth.json` and are stored under the
  configured accounts root (default `~/.codex-accounts`). Protect that folder.
- Switching accounts overwrites the native `auth.json` after taking a backup.
- The only network access is the quota read performed through the locally
  installed Codex app-server (the same backend the Codex client itself uses).
  There is no telemetry, analytics, or upload to any third party.

Codex, OpenAI, DeepSeek, and DeepSeek Harness are trademarks of their
respective owners.
