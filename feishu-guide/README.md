# 飞书 Clawdbot 配置指南

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Clawdbot](https://img.shields.io/badge/Clawdbot-2026.1-blue.svg)](https://clawd.bot)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> 🦞 一键配置 Clawdbot 接入飞书，让你的 AI 助手在飞书中工作

## ✨ 特色

- 🚀 **开箱即用** - Clone 后只需 3 个命令即可完成配置
- 🔒 **无需公网** - 使用飞书长连接，无需公网域名和 Webhook
- ⚡ **自动化脚本** - 一键安装、交互式配置，零门槛上手
- 📦 **完整插件** - 包含完整的飞书插件源代码
- 📖 **详细文档** - 从零开始的完整配置流程

## 🚀 快速开始

### 前置要求

- macOS、Linux 或 Windows（需要 Git Bash）
- Node.js 18+ 
- 网络连接

### 三步完成配置

```bash
# 1. Clone 仓库
git clone https://github.com/YOUR_USERNAME/feishu-clawdbot-guide.git
cd feishu-clawdbot-guide

# 2. 一键安装（自动安装 Clawdbot 和插件）
./quick-start.sh

# 3. 配置向导（交互式配置 API 和飞书信息）
./configure.sh

# 4. 启动 Gateway
clawdbot gateway --verbose
```

### 配置飞书后台

Gateway 启动后，访问 [飞书开放平台](https://open.feishu.cn/app)：

1. 进入你的应用 → **事件与回调** → **事件配置**
2. 选择「**使用长连接接收事件**」
3. 订阅事件：`im.message.receive_v1`
4. 保存配置

### 权限配置

在飞书后台 **权限管理** 中申请以下权限（可直接搜索）：

- ✅ `im:message`（获取与发送单聊、群组消息）
- ✅ `im:message:send_as_bot`（读取用户发给机器人的单聊消息）
- ✅ `im:message.p2p_msg`（接收机器人单聊消息/事件）
- ✅ `im:chat`（获取群组信息）

### 测试

在飞书中找到你的机器人，发送消息：

```
你好，介绍一下你自己
```

如果配置了 `dmPolicy: "pairing"`，首次使用需要配对：

```bash
# 批准配对
clawdbot pairing approve feishu <配对码>
```

## 📁 项目结构

```
feishu-clawdbot-guide/
├── README.md                  # 本文件
├── quick-start.sh             # 🚀 一键安装脚本
├── configure.sh               # ⚙️ 配置向导脚本
├── install-plugin.sh          # 📦 插件安装脚本
├── docs/                      # 📖 详细文档
│   ├── 01-installation.md            # 安装 Clawdbot
│   ├── 02-model-configuration.md     # 配置模型提供商
│   ├── 03-feishu-app-setup.md        # 创建飞书应用
│   ├── 04-plugin-installation.md     # 安装飞书插件
│   ├── 05-gateway-setup.md           # 启动和配置 Gateway
│   └── 06-troubleshooting.md         # 故障排查
├── config-examples/           # 📝 配置文件示例
│   ├── clawdbot.json                 # 完整配置示例
│   ├── clawdbot.minimal.json         # 最小配置示例
│   └── README.md                      # 配置说明
├── feishu-plugin/             # 📁 飞书插件源代码
│   ├── clawdbot.plugin.json
│   ├── package.json
│   ├── index.ts
│   └── src/
│       ├── channel.ts
│       ├── runtime.ts
│       ├── feishu-ws.ts
│       └── send.ts
└── images/                    # 🖼️ 截图和示意图
```

## 📖 详细文档

### 安装与配置

- [01. 安装 Clawdbot](docs/01-installation.md)
- [02. 配置模型提供商](docs/02-model-configuration.md)（Claude API / 中转站 / 本地模型）
- [03. 创建飞书应用](docs/03-feishu-app-setup.md)
- [04. 安装飞书插件](docs/04-plugin-installation.md)
- [05. 启动和配置 Gateway](docs/05-gateway-setup.md)
- [06. 故障排查](docs/06-troubleshooting.md)

### 配置示例

查看 [config-examples/](config-examples/) 目录获取：

- 完整配置示例（支持多个模型）
- 最小配置示例（快速开始）
- 不同 API 提供商的配置方式

## 🔧 手动配置

如果你想手动配置而不使用自动化脚本：

### 1. 安装 Clawdbot

```bash
curl -fsSL https://clawd.bot/install.sh | bash
```

### 2. 复制插件

```bash
cp -r feishu-plugin ~/.clawdbot/extensions/feishu
cd ~/.clawdbot/extensions/feishu
npm install
```

### 3. 编辑配置

编辑 `~/.clawdbot/clawdbot.json`，参考 [config-examples/clawdbot.json](config-examples/clawdbot.json)

### 4. 启动

```bash
clawdbot gateway --verbose
```

## ❓ 常见问题

### Q: 为什么选择长连接而不是 Webhook？

**A:** 长连接的优势：
- ✅ 无需公网域名
- ✅ 无需配置反向代理（Cloudflare Tunnel、Tailscale Funnel 等）
- ✅ 无需配置加密策略
- ✅ 更安全（不暴露公网端口）
- ✅ 配置更简单

### Q: 支持哪些 API 提供商？

**A:** 支持所有兼容 Anthropic Messages API 或 OpenAI Completions API 的提供商：
- Claude API（官方）
- OpenAI API
- 各种中转站 API
- 本地模型（Ollama、LM Studio 等）

### Q: 如何更新插件？

**A:** 重新运行安装脚本即可：

```bash
git pull
./install-plugin.sh
clawdbot gateway stop
clawdbot gateway --verbose
```

### Q: 遇到问题怎么办？

**A:** 查看 [故障排查文档](docs/06-troubleshooting.md) 或：
- 查看日志：`tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log`
- 运行诊断：`clawdbot doctor`
- 访问社区：[Moltbot Discord](https://discord.gg/clawdbot)

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与。

### 贡献方式

- 🐛 报告 Bug
- 💡 提出新功能
- 📖 改进文档
- 🌐 添加多语言支持
- 📷 提供配置截图

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [Moltbot/Clawdbot](https://clawd.bot) - 强大的个人 AI 助手框架
- [飞书开放平台](https://open.feishu.cn) - 提供开放平台能力
- 社区贡献者

## ⭐ Star History

如果这个项目对你有帮助，请给一个 Star ⭐

## 🔗 相关链接

- [Clawdbot 官网](https://clawd.bot)
- [Clawdbot GitHub](https://github.com/moltbot/moltbot)
- [飞书开放平台](https://open.feishu.cn)
- [飞书开放平台文档](https://open.feishu.cn/document)

---

<div align="center">
  Made with ❤️ by the community
</div>
