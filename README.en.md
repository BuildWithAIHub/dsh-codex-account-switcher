# DSH Codex Account Switcher

Manage the Codex login used by the Codex subagent from the DSH **Plugins page**: save the current `auth.json` as named snapshots, switch between accounts, and read the account's Codex usage quota.

> 中文说明见 [README.md](README.md).

## Features

- **Account snapshots**: save the current `$CODEX_HOME/auth.json` (default `~/.codex/auth.json`) as a named account and restore it later.
- **Switch accounts**: applying an account writes its `auth.json` back to the Codex home; the previous login is backed up under `<accounts root>/_auto/<timestamp>/` first.
- **Quota display**: reads `account/rateLimits/read` through the Codex app-server and shows plan, 5-hour / 7-day usage, and reset times on the plugin card.
- **Proxy setting**: quota reads need a reachable OpenAI endpoint; set an HTTP proxy (e.g. `http://127.0.0.1:10090`) in the plugin configuration, or leave it empty to follow the system proxy environment.

## Install

```bash
dsh plugin --profile desktop add github:BuildWithAIHub/dsh-codex-account-switcher
```

In DSH Desktop you can also use **Settings → Plugins** and paste the GitHub spec. Refresh the page or restart DSH afterwards.

Requires DSH `>= 0.2.1-rc.1` and an existing Codex login on the machine.

## Data and security (read this)

- Account snapshots are stored in `~/.codex-accounts/` by default (configurable). A snapshot is a **full copy of `auth.json`, including the Codex OAuth token** — protect that folder like a password.
- Switching accounts overwrites `~/.codex/auth.json`; a backup is taken first (`_auto/`).
- No third-party telemetry or upload code. The only network use is the quota read against Codex's own backend (same as the Codex client; without network/proxy the status is reported as unknown instead of hanging).
- Not affiliated with OpenAI or DeepSeek. Use at your own risk.

## License

MIT, see [LICENSE](LICENSE).
