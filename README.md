# DSH Codex Account Switcher

在 DSH 的 **Plugins 页面**上管理 Codex 子智能体使用的登录账号：把当前 `auth.json` 保存为命名快照、在账号之间切换，并读取该账号的 Codex 额度（rate limits）。

> English: see [README.en.md](README.en.md).

## 功能

- **账号快照**：把 `$CODEX_HOME/auth.json`（默认 `~/.codex/auth.json`）当前登录保存为命名账号，之后可一键切回。
- **切换账号**：选择某个账号后，插件会把它的 `auth.json` 写回 Codex home；切换前会把当前登录自动备份到 `<账号目录>/_auto/<时间戳>/`。
- **额度显示**：通过 Codex 自带的 app-server 读取 `account/rateLimits/read`，在插件卡片里显示套餐、5 小时/7 天用量与重置时间。
- **代理设置**：读取额度需要能连上 OpenAI，可在插件配置里填 HTTP 代理（例如 `http://127.0.0.1:10090`）；留空自动跟随系统代理环境变量。

## 安装

```bash
dsh plugin --profile desktop add github:BuildWithAIHub/dsh-codex-account-switcher
```

DSH Desktop 也可以在 **Settings → Plugins** 里粘贴上面的 GitHub 地址安装。装完刷新页面或重启 DSH。

要求：DSH `>= 0.2.1-rc.1`，且本机已有可用的 Codex 登录。

## 数据与安全（重要）

- 账号快照默认存放在 `~/.codex-accounts/`（可在插件配置里改），快照内容就是 **`auth.json` 的完整拷贝，包含 Codex 的 OAuth token**。请像对待密码一样保护这个目录。
- 切换账号会覆盖 `~/.codex/auth.json`；每次覆盖前插件会先做一份自动备份（`_auto/` 目录）。
- 插件**没有**第三方遥测或上传代码；唯一的网络行为是读取额度时调用 Codex 自己的后端（与 Codex 客户端相同；没有网络/代理时会显示"未知"而不是报错卡死）。
- 本插件与 OpenAI / DeepSeek 均无关联，使用风险自负。

## 许可

MIT，见 [LICENSE](LICENSE)。
