# Outlook / Microsoft 365 OAuth2 配置指南

这份指南按“小白也能照着点”的方式写。目标是拿到这几个值：

- `clientId`
- 可选的 `clientSecret`
- `refreshToken`

拿到以后，就能填进本项目的 `config.local.json`。

## 1. 去微软后台注册应用

打开微软 Entra 管理中心的应用注册页面：

- https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app

你需要做的事：

1. 登录你的微软账号或 Microsoft 365 管理账号。
2. 创建一个新应用。
3. 记下 `Application (client) ID`，这就是 `clientId`。
4. 租户如果不确定，可以先用 `common`；企业环境也可以记下 `Directory (tenant) ID`。

## 1.1 开启 Public Client Flow

因为本项目内置的辅助脚本使用的是微软的 `device code flow`，所以你还要在应用注册里开启 public client flow。

操作位置：

1. 打开应用注册
2. 进入 `Authentication`
3. 在高级设置里，把 `Allow public client flows` 打开
4. 保存

相关官方说明：

- https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-mobile-app-sign-in
- https://learn.microsoft.com/en-us/entra/msal/msal-authentication-flows

## 2. 给应用加 SMTP 权限

微软官方 SMTP OAuth 文档：

- https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth

这个项目发送邮件至少需要：

- `https://outlook.office.com/SMTP.Send`
- `offline_access`

通俗理解：

- `SMTP.Send` 允许它代表你通过 Outlook SMTP 发信
- `offline_access` 允许拿到 `refreshToken`

## 3. 最简单拿 refreshToken 的办法

这个项目已经内置了一个辅助脚本：

```bash
cd /root/plugins/codex-email-notify
npm run token:microsoft -- --client-id 你的ClientId
```

如果你不是默认租户，也可以指定：

```bash
npm run token:microsoft -- --client-id 你的ClientId --tenant common
```

脚本会让你做两件事：

1. 打开微软给出的登录网址
2. 输入屏幕上显示的验证码

你登录并同意授权后，脚本会自动输出一段 JSON，其中就包含：

- `clientId`
- `refreshToken`
- `accessToken`
- `scope`

## 4. 什么时候需要 clientSecret

对于新手，最简单的路径是：

- 先只用 `clientId + refreshToken`
- 不一定非要马上配 `clientSecret`

如果你后面要按企业规范走“机密客户端”方式，再去微软后台生成 `clientSecret` 即可。

微软官方关于添加凭据：

- https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app#add-credentials

## 5. 填到 config.local.json

最小可用配置示例：

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
    "clientId": "你的ClientId",
    "refreshToken": "脚本拿到的RefreshToken",
    "scope": "https://outlook.office.com/SMTP.Send offline_access"
  }
}
```

如果你已经生成了 `clientSecret`，也可以加上：

```json
"clientSecret": "你的ClientSecret"
```

## 6. 别忘了改 Codex 配置

打开你自己的 `~/.codex/config.toml`，加入：

```toml
notify = ["node", "/root/plugins/codex-email-notify/scripts/email-notify.mjs"]
```

否则 Codex 任务完成后不会自动调用插件。

## 7. 最后做一次测试

先干跑：

```bash
echo '{"event":"agent-turn-complete","session_id":"s1","turn_id":"t1","cwd":"/root","model":"gpt-5.4","input_messages":[{"role":"user","content":"发送测试通知"}],"last_assistant_message":"已经完成。"}' \
  | node /root/plugins/codex-email-notify/scripts/email-notify.mjs --dry-run
```

如果干跑正常，再去实际触发一次 Codex 任务，看是否能收到 Outlook 邮件。

## 8. 常见坑

- 没加 `offline_access`，就拿不到 `refreshToken`
- SMTP 主机要用 `smtp-mail.outlook.com`
- 端口一般用 `587`
- `secure` 一般配 `false`，因为 587 走 STARTTLS
- `oauth2.user` 一般就是你实际发信的 Outlook 邮箱
