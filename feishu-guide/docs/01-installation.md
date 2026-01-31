# 01. 安装 Clawdbot

本文档介绍如何在不同操作系统上安装 Clawdbot。

## 系统要求

- **操作系统**：macOS、Linux 或 Windows
- **Node.js**：18.0 或更高版本
- **内存**：至少 4GB RAM（推荐 8GB）
- **磁盘空间**：至少 1GB 可用空间
- **网络**：稳定的互联网连接

## 方法一：使用官方一键安装脚本（推荐）

### macOS / Linux

打开终端，运行：

```bash
curl -fsSL https://clawd.bot/install.sh | bash
```

安装脚本会自动：
- 检测系统环境
- 安装 Node.js（如果未安装）
- 下载并安装 Clawdbot
- 配置环境变量

### Windows

#### 使用 PowerShell

```powershell
irm https://clawd.bot/install.ps1 | iex
```

#### 使用 CMD

```cmd
curl -fsSL https://clawd.bot/install.bat | cmd
```

## 方法二：使用本仓库的快速安装脚本

如果你已经 clone 了本仓库：

```bash
cd feishu-clawdbot-guide
./quick-start.sh
```

快速安装脚本会：
1. 安装 Clawdbot（如果未安装）
2. 自动安装飞书插件
3. 安装插件依赖

## 方法三：手动安装

### 1. 安装 Node.js

如果系统中没有 Node.js，请先安装：

#### macOS（使用 Homebrew）

```bash
brew install node
```

#### Linux（使用 nvm）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

#### Windows

访问 [Node.js 官网](https://nodejs.org/) 下载并安装。

### 2. 使用 npm 安装 Clawdbot

```bash
npm install -g clawdbot
```

### 3. 验证安装

```bash
clawdbot --version
```

应该看到类似输出：

```
🦞 Clawdbot 2026.1.24-3 (885167d)
```

## 验证安装

### 运行初始化向导

```bash
clawdbot onboard
```

这会启动交互式配置向导，帮助你：
- 选择模型提供商
- 配置 API 密钥
- 选择通讯渠道
- 设置工作空间

### 检查安装状态

```bash
clawdbot doctor
```

这会检查：
- ✅ Node.js 版本
- ✅ 配置文件完整性
- ✅ 插件状态
- ✅ 网络连接

## 常见问题

### Q: 安装脚本失败，提示权限错误

**A:** 尝试使用 sudo（仅限 macOS/Linux）：

```bash
curl -fsSL https://clawd.bot/install.sh | sudo bash
```

### Q: npm install -g 失败

**A:** 可能需要配置 npm 权限：

```bash
# 方法 1：使用 npx
npx clawdbot --version

# 方法 2：配置 npm 全局目录
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Q: Windows 上安装失败

**A:** 尝试以下方法：
1. 使用管理员权限运行 PowerShell
2. 先安装 Node.js，然后使用 `npm install -g clawdbot`
3. 在 WSL2 中安装（推荐）

### Q: 如何更新 Clawdbot？

**A:** 运行：

```bash
npm update -g clawdbot

# 或使用官方更新命令
clawdbot update
```

## 下一步

安装完成后，继续配置：

- [02. 配置模型提供商](02-model-configuration.md) - 配置 Claude API 或其他 API
- [03. 创建飞书应用](03-feishu-app-setup.md) - 在飞书开放平台创建应用

## 相关资源

- [Clawdbot 官方文档](https://clawd.bot)
- [Clawdbot GitHub](https://github.com/moltbot/moltbot)
- [Node.js 官网](https://nodejs.org/)
