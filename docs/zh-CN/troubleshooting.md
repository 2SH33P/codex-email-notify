# 排错指南

## 1. 没有收到邮件

先检查以下几项：

- `config.local.json` 是否存在，或者环境变量是否正确设置
- `to` 是否填写了有效邮箱
- `smtp.host`、`smtp.port`、`smtp.user`、`smtp.pass` 是否正确
- SMTP 服务商是否要求应用专用密码

建议先跑一遍干跑测试，确认脚本本身能生成邮件内容。

## 2. 日志提示 `Missing recipient or SMTP settings`

这表示脚本没有拿到完整配置。

通常原因有：

- 没设置 `to`
- 没设置 `smtp.host`
- 环境变量只在管道左侧命令生效，没有传给 Node 进程

## 3. 端口和 `secure` 配错

常见规则：

- 端口 `465` 通常配 `secure: true`
- 端口 `587` 通常配 `secure: false`

如果配反，常见表现是 TLS 握手失败或连接超时。

## 4. Gmail / 企业邮箱无法登录

不少邮箱服务不接受普通账户密码直接登录 SMTP。

你通常需要：

- 开启 SMTP 服务
- 使用应用专用密码
- 或按照服务商要求启用 OAuth / 安全策略

## 5. 收到重复邮件

本插件已经做了按 `session_id + turn_id` 的去重。

如果你仍然收到重复邮件，通常是以下情况之一：

- 多个不同的 Codex 会话在同一个目录运行
- 你清空了状态目录
- 上游事件本身给了不同的 `turn_id`

可以通过 `CODEX_EMAIL_NOTIFY_STATE_DIR` 指定固定状态目录，避免临时目录变化影响去重。

## 6. `Stop` hook 没有生效

先确认：

- Codex 是否启用了 hooks 功能
- `hooks.json` 是否被正确加载
- 脚本是否能返回合法 JSON

本项目中的 `Stop` hook 在成功执行后会返回：

```json
{"continue": true}
```

## 7. 只想验证解析，不想真的发邮件

使用：

```bash
node /root/plugins/codex-email-notify/scripts/email-notify.mjs --dry-run
```

或者设置：

```bash
export CODEX_EMAIL_NOTIFY_DRY_RUN=true
```

## 8. 想切换到环境变量配置

完全可以。环境变量优先级高于 `config.local.json`。

这适合：

- CI
- Docker
- 远程服务器
- 不希望把 SMTP 密码放在文件里的场景
