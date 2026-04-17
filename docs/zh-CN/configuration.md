# 配置说明

本插件支持两类配置来源：

- `config.local.json`
- 环境变量

如果两者同时存在，环境变量优先。

## 配置文件位置

默认配置文件路径：

```text
/root/plugins/codex-email-notify/config.local.json
```

你可以参考项目根目录下的 `config.example.json` 创建自己的配置文件。

## 配置文件字段

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

字段说明：

- `to`
  收件人列表，可以写一个或多个邮箱地址。
- `from`
  发件人地址。若未填写，脚本会优先回退到 `smtp.user`，再回退到 `codex-notify@localhost`。
- `subjectPrefix`
  邮件标题前缀，默认是 `[Codex]`。
- `smtp.host`
  SMTP 服务器地址。
- `smtp.port`
  SMTP 服务器端口。常见是 `587` 或 `465`。
- `smtp.secure`
  是否启用 SMTPS。通常 `465` 用 `true`，`587` 用 `false`。
- `smtp.user`
  SMTP 登录用户名。
- `smtp.pass`
  SMTP 登录密码或应用专用密码。

## 环境变量

脚本支持以下环境变量：

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

说明：

- `CODEX_EMAIL_NOTIFY_TO` 支持逗号分隔多个邮箱。
- `CODEX_EMAIL_NOTIFY_DRY_RUN` 可以用 `1`、`true`、`yes`、`on` 开启。
- `CODEX_EMAIL_NOTIFY_STATE_DIR` 用于保存去重标记文件。

## 推荐配置方式

如果你只是在本机上使用，建议直接写 `config.local.json`。

如果你在 CI、服务器或容器里使用，建议改为环境变量，以免把敏感信息写进文件。

## Codex 原生通知配置

当前环境已在 `~/.codex/config.toml` 中配置：

```toml
notify = ["node", "/root/plugins/codex-email-notify/scripts/email-notify.mjs"]
```

这表示 Codex 在任务完成后会调用本插件脚本。

## Hook 回退模式

如果你想额外启用 `Stop` hook，可以在 Codex 配置里打开 hooks 功能，再加载项目中的 `hooks.json`。

本插件内部有去重逻辑，所以同时开启原生 `notify` 和 `Stop` hook 时，不会对同一轮任务重复发信。
