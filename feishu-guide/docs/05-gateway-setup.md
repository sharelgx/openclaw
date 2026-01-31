# 05. 启动和配置 Gateway

本文档介绍如何启动 Clawdbot Gateway 并完成飞书长连接配置。

## Gateway 简介

Gateway 是 Clawdbot 的核心服务，负责：
- 管理所有频道连接（Telegram、飞书等）
- 处理消息路由
- 运行 AI 模型
- 管理插件和技能

## 启动 Gateway

### 基础启动

```bash
clawdbot gateway
```

### 详细日志模式（推荐）

```bash
clawdbot gateway --verbose
```

详细模式会显示：
- 插件加载状态
- 长连接状态
- 消息接收日志
- AI 处理过程

### 后台运行

```bash
# macOS / Linux
nohup clawdbot gateway &

# 或使用 screen
screen -S clawdbot
clawdbot gateway --verbose
# 按 Ctrl+A, D 分离会话
```

## 配置飞书长连接

### 步骤 1：启动 Gateway

**⚠️ 重要：必须先启动 Gateway！**

```bash
clawdbot gateway --verbose
```

等待看到：

```
[gateway] 飞书插件已加载（长连接模式，无需 webhook 地址）
[feishu] 启动长连接 (account=default)
[feishu] 正在启动长连接…
[feishu] 防抖时间: 0ms
[feishu] 长连接已连接
```

### 步骤 2：配置飞书后台

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 进入你的应用
3. 点击「**事件与回调**」→「**事件配置**」
4. 在「**订阅方式**」中选择：
   - ✅ **使用长连接接收事件**
5. 点击「**保存**」（此时才能保存成功）

### 步骤 3：订阅事件

1. 在「**添加事件**」中搜索并勾选：
   - ✅ `im.message.receive_v1` - 接收消息
2. 点击「**保存**」

### 步骤 4：测试连接

在飞书中找到你的机器人，发送测试消息：

```
你好
```

查看 Gateway 日志，应该看到：

```
[feishu] 收到消息 chat=oc_xxx from=ou_xxx type=text len=2
```

## 配对授权（如果使用 pairing 模式）

如果配置了 `dmPolicy: "pairing"`，首次使用需要配对。

### 1. 发送消息触发配对

在飞书中给机器人发送消息，会收到：

```
Clawdbot: access not configured.

Your Feishu user id: ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Pairing code: ABCD1234

Ask the bot owner to approve with:
clawdbot pairing approve feishu <code>
```

### 2. 批准配对

在终端运行：

```bash
clawdbot pairing approve feishu ABCD1234
```

应该看到：

```
Approved feishu sender ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.
```

### 3. 再次发送消息

现在机器人应该会正常回复了！

## Gateway 管理命令

### 查看状态

```bash
clawdbot gateway status
```

### 停止 Gateway

```bash
clawdbot gateway stop
```

### 重启 Gateway

```bash
clawdbot gateway stop
clawdbot gateway --verbose
```

### 查看日志

```bash
# 实时日志
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log

# 只看飞书相关日志
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep feishu

# 查看历史日志
ls /tmp/clawdbot/
```

### 诊断问题

```bash
clawdbot doctor
```

## 配置文件位置

- **主配置文件**：`~/.clawdbot/clawdbot.json`
- **插件目录**：`~/.clawdbot/extensions/`
- **日志目录**：`/tmp/clawdbot/`
- **工作空间**：`~/clawd/` （默认）

## 测试流程

### 1. 基础测试

发送简单消息：

```
你好
介绍一下你自己
```

### 2. 多轮对话

```
你：今天天气怎么样？
AI：（回复）
你：那明天呢？
AI：（应该能理解上下文）
```

### 3. 工具使用

如果配置了技能：

```
帮我查看系统时间
搜索关于 AI 的新闻
```

### 4. 长消息

发送超过 4000 字符的消息，测试消息分片。

## 性能优化

### 配置防抖时间

在配置文件中添加：

```json
{
  "messages": {
    "inbound": {
      "debounceMs": 1000,
      "byChannel": {
        "feishu": 500
      }
    }
  }
}
```

- `debounceMs`: 全局防抖时间（毫秒）
- `byChannel.feishu`: 飞书专用防抖时间

### 配置消息批处理

```json
{
  "messages": {
    "maxBatchSize": 10
  }
}
```

## 常见问题

### Q: Gateway 启动后立即退出

**A:** 可能原因：
1. **配置文件错误** → 运行 `clawdbot doctor`
2. **端口被占用** → 修改配置中的 `gateway.port`
3. **权限问题** → 检查文件权限

### Q: 飞书后台无法保存长连接配置

**A:** 必须先启动 Gateway：
```bash
clawdbot gateway --verbose
# 等待看到 "[feishu] 长连接已连接"
# 然后去飞书后台保存
```

### Q: 收到消息但 AI 不回复

**A:** 检查：
1. **模型配置** → 查看日志中的错误
2. **API Key** → 验证是否正确
3. **网络连接** → 测试 API 可达性
4. **配对状态** → 如果使用 pairing，确认已批准

### Q: 消息延迟很高

**A:** 优化方法：
1. **降低防抖时间** → 修改 `messages.inbound.debounceMs`
2. **使用更快的模型** → 例如 Haiku 而不是 Opus
3. **检查网络** → 使用中转站可能更快

### Q: Gateway 占用内存过高

**A:** 优化：
1. **限制上下文长度** → 配置 `contextWindow`
2. **清理历史消息** → 定期重启 Gateway
3. **减少加载的插件** → 禁用不需要的插件

### Q: 如何同时使用多个频道？

**A:** 在配置文件中添加多个频道：

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "..."
    },
    "feishu": {
      "enabled": true,
      "appId": "...",
      "appSecret": "..."
    }
  }
}
```

## 下一步

Gateway 配置完成后：

- 测试各种功能
- 查看 [故障排查](06-troubleshooting.md) 了解常见问题
- 探索更多技能和插件
- [返回主文档](../README.md)

## 相关资源

- [Clawdbot 官方文档](https://clawd.bot)
- [配置文件示例](../config-examples/)
- [故障排查](06-troubleshooting.md)
