# Codex Email Notify

语言: [English](./README.md) | [简体中文](./README.zh-CN.md)

这是一个本地 OpenAI Codex 插件。它使用 Node.js 编写通知脚本，在 Codex 每次任务完成后通过 SMTP 自动发送邮件。

## 文档目录

- [配置说明](./docs/zh-CN/configuration.md)
- [Outlook / Microsoft 365 OAuth2 配置指南](./docs/zh-CN/outlook-oauth2-setup.md)
- [使用说明](./docs/zh-CN/usage.md)
- [排错指南](./docs/zh-CN/troubleshooting.md)

## 功能概览

- 支持 Codex 原生 `notify` 回调
- 支持 `Stop` hook 作为回退触发方式
- 通过 `nodemailer` 发送 SMTP 邮件
- 支持普通 SMTP 密码认证，也支持 Outlook / Microsoft 365 OAuth2
- 按 `session_id + turn_id` 去重，避免同一轮任务重复发信
- 支持 `config.local.json` 和环境变量两种配置方式
- 支持 `--dry-run` 干跑测试

## 项目结构

- `.codex-plugin/plugin.json`
  插件清单文件，供 Codex 识别插件元数据。
- `scripts/email-notify.mjs`
  核心通知脚本，负责读取 Codex 传入的 JSON 负载、生成邮件内容并发送。
- `config.example.json`
  配置示例文件，展示收件人和 SMTP 参数结构。
- `hooks.json`
  可选的 `Stop` hook 配置。
- `docs/zh-CN/`
  中文文档目录。

## 工作方式

这个插件优先使用 Codex 的原生 `notify` 能力。

要让插件真正生效，你必须修改你自己的 `~/.codex/config.toml`，加入：

```toml
notify = ["node", "/绝对路径/codex-email-notify/scripts/email-notify.mjs"]
```

如果项目路径和当前仓库一致，可以直接写：

```toml
notify = ["node", "/root/plugins/codex-email-notify/scripts/email-notify.mjs"]
```

不加这行的话，Codex 在任务完成后不会自动调用这个插件，也就不会发邮件。

脚本收到负载后会做几件事：

1. 解析 `notify` 或 `Stop` hook 的 JSON 输入。
2. 提取当前工作目录、会话 ID、回合 ID、用户输入摘要和助手最后一条消息。
3. 根据本地配置拼出邮件标题和正文。
4. 使用 SMTP 发送邮件。
5. 记录去重标记，避免同一回合重复通知。

## 快速开始

1. 安装依赖：

```bash
cd /root/plugins/codex-email-notify
npm install
```

2. 创建本地配置：

可以复制 `config.example.json` 的结构，创建 `config.local.json`。

```json
{
  "to": ["you@example.com"],
  "from": "codex@example.com",
  "subjectPrefix": "[Codex]",
  "authType": "password",
  "smtp": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "user": "smtp-user@example.com",
    "pass": "app-password"
  }
}
```

如果你要接入 Outlook / Microsoft 365 的 OAuth2，可以改成：

```json
{
  "to": ["you@example.com"],
  "from": "your-outlook@example.com",
  "subjectPrefix": "[Codex]",
  "authType": "oauth2",
  "smtp": {
    "host": "smtp-mail.outlook.com",
    "port": 587,
    "secure": false,
    "user": "your-outlook@example.com"
  },
  "oauth2": {
    "provider": "microsoft",
    "tenant": "common",
    "user": "your-outlook@example.com",
    "clientId": "your-microsoft-app-client-id",
    "clientSecret": "your-microsoft-app-client-secret",
    "refreshToken": "your-microsoft-refresh-token",
    "scope": "https://outlook.office.com/SMTP.Send offline_access"
  }
}
```

说明：

- `authType = "oauth2"` 表示强制使用 OAuth2
- `tenant` 默认可以先用 `common`
- 如果你的企业租户有特殊要求，可以把 `tenant` 改成租户 ID 或域名
- 脚本会用 refresh token 自动换 access token，再通过 SMTP 发信
- 如果你是小白，推荐先看 [Outlook / Microsoft 365 OAuth2 配置指南](./docs/zh-CN/outlook-oauth2-setup.md)

3. 修改 `~/.codex/config.toml`：

```toml
notify = ["node", "/root/plugins/codex-email-notify/scripts/email-notify.mjs"]
```

4. 运行干跑测试：

```bash
echo '{"event":"agent-turn-complete","session_id":"s1","turn_id":"t1","cwd":"/root","model":"gpt-5.4","input_messages":[{"role":"user","content":"运行测试并修复失败"}],"last_assistant_message":"测试已经全部通过。"}' \
  | node /root/plugins/codex-email-notify/scripts/email-notify.mjs --dry-run
```

## 进一步阅读

- 详细配置见 [配置说明](./docs/zh-CN/configuration.md)
- 运行方式见 [使用说明](./docs/zh-CN/usage.md)
- 常见问题见 [排错指南](./docs/zh-CN/troubleshooting.md)
