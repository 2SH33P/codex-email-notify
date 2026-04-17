# 使用说明

## 安装依赖

在插件目录执行：

```bash
cd /root/plugins/codex-email-notify
npm install
```

## 准备配置

最简单的方式是在项目根目录创建 `config.local.json`，内容参考：

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

## 修改 Codex 配置

这一步是必须的。

打开你自己的 `~/.codex/config.toml`，加入：

```toml
notify = ["node", "/绝对路径/codex-email-notify/scripts/email-notify.mjs"]
```

如果项目路径和当前仓库一致，可以直接写：

```toml
notify = ["node", "/root/plugins/codex-email-notify/scripts/email-notify.mjs"]
```

只有加了这项，Codex 在任务完成时才会自动执行插件脚本。

## 运行逻辑

当 Codex 完成一轮任务后，会调用：

```bash
node /root/plugins/codex-email-notify/scripts/email-notify.mjs
```

Codex 会通过标准输入把 JSON 负载传给脚本。脚本会自动识别两类负载：

- 原生 `notify` 完成事件
- `Stop` hook 事件

## 干跑测试

不实际发邮件，只检查脚本能否正确生成邮件内容：

```bash
echo '{"event":"agent-turn-complete","session_id":"s1","turn_id":"t1","cwd":"/root","model":"gpt-5.4","input_messages":[{"role":"user","content":"修复失败测试"}],"last_assistant_message":"已经修复完成。"}' \
  | node /root/plugins/codex-email-notify/scripts/email-notify.mjs --dry-run
```

## 真实发送测试

当你已经配置好真实 SMTP 参数后，可以用同样的方式去掉 `--dry-run`：

```bash
echo '{"event":"agent-turn-complete","session_id":"s1","turn_id":"t1","cwd":"/root","model":"gpt-5.4","input_messages":[{"role":"user","content":"修复失败测试"}],"last_assistant_message":"已经修复完成。"}' \
  | node /root/plugins/codex-email-notify/scripts/email-notify.mjs
```

## 邮件内容

脚本会在邮件中包含这些信息：

- 事件类型
- 会话 ID
- 回合 ID
- 使用的模型
- 当前工作目录
- 用户输入摘要
- 助手最后一条消息

## 去重机制

脚本会在本地状态目录里写入标记文件，键值基于：

```text
session_id + turn_id
```

这样即使同一轮任务被 `notify` 和 `Stop` hook 同时触发，也只会发一封邮件。
