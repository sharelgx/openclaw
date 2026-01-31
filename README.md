# OpenClaw - AI 个人助手平台

<p align="center">
  <img src="https://img.shields.io/badge/version-2026.01.31.8-blue" alt="version">
  <img src="https://img.shields.io/badge/platform-Windows-lightgrey" alt="platform">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-green" alt="node">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="license">
</p>

OpenClaw 是一个多渠道 AI 个人助手平台，支持飞书、企业微信、WebChat、TUI 等多种接入方式，提供统一的会话管理和 AI 能力。

---

## 功能特性

### 多渠道接入
- **飞书** - 支持私聊和群聊，长连接实时消息
- **企业微信** - 支持私聊和群聊，WebSocket 中转
- **WebChat** - 浏览器端聊天界面
- **TUI** - 终端命令行界面

### AI 能力
- **智谱 GLM-4.7** - 强大的中文大语言模型
- **流式响应** - "思考中"状态实时显示
- **多渠道会话统一** - 不同渠道共享同一会话上下文

### 飞书云文档集成
| 功能 | 工具名称 | 说明 |
|------|---------|------|
| 创建文档 | `save_to_feishu_doc` | 支持新建和每日文档模式 |
| 读取文档 | `read_feishu_doc` | 读取文档纯文本内容 |
| 追加内容 | `append_to_feishu_doc` | 在文档末尾追加内容 |
| 编辑文档 | `edit_feishu_doc` | 替换整个文档内容 |
| 删除文件 | `delete_feishu_file` | 删除文档或表格 |
| 创建表格 | `create_feishu_sheet` | 创建电子表格并写入数据 |
| 列出文件夹 | `list_feishu_folders` | 浏览云空间目录结构 |

---

## Windows 部署指南

### 环境要求

- **操作系统**: Windows 10/11
- **Node.js**: >= 18.0.0
- **包管理器**: pnpm
- **Git**: 用于克隆代码

### 第一步：安装依赖

```powershell
# 1. 安装 Node.js (推荐使用 nvm-windows)
# 下载地址: https://github.com/coreybutler/nvm-windows/releases

# 2. 安装 pnpm
npm install -g pnpm

# 3. 验证安装
node -v    # 应显示 v18.x.x 或更高
pnpm -v    # 应显示 pnpm 版本号
```

### 第二步：克隆项目

```powershell
# 克隆仓库
git clone https://github.com/sharelgx/openclaw.git
cd openclaw

# 进入核心目录并安装依赖
cd openclaw
pnpm install
```

### 第三步：初始化配置

```powershell
# 运行初始化向导
pnpm openclaw onboard

# 向导会引导你配置：
# - AI 模型 (选择 智谱AI GLM-4.7)
# - API Key (从 https://open.bigmodel.cn/ 获取)
# - Gateway 端口 (默认 18789)
```

配置文件位置: `C:\Users\<用户名>\.openclaw\openclaw.json`

### 第四步：配置飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 `App ID` 和 `App Secret`
4. 添加以下权限：

```
im:message                    # 接收消息
im:message:send_as_bot       # 发送消息
im:chat:readonly             # 读取群信息
contact:user.id:readonly     # 读取用户ID
docx:document:create         # 创建文档
docx:document:readonly       # 读取文档
sheets:spreadsheet           # 操作表格
drive:drive:readonly         # 读取云空间
drive:file                   # 文件操作
```

5. 配置事件订阅：选择 **长连接** 模式
6. 发布应用

### 第五步：安装飞书插件

```powershell
# 复制飞书插件到扩展目录
$extensionsPath = "$env:USERPROFILE\.openclaw\extensions\feishu"
New-Item -ItemType Directory -Path $extensionsPath -Force

# 复制插件文件
Copy-Item -Path "feishu-guide\feishu-plugin\*" -Destination $extensionsPath -Recurse -Force
```

### 第六步：更新配置文件

编辑 `C:\Users\<用户名>\.openclaw\openclaw.json`，添加飞书配置：

```json
{
  "plugins": {
    "entries": {
      "feishu": {
        "enabled": true
      }
    }
  },
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "你的飞书AppID",
      "appSecret": "你的飞书AppSecret",
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "useCard": true
    }
  }
}
```

### 第七步：启动服务

```powershell
# 进入 OpenClaw 核心目录
cd openclaw

# 启动 Gateway (带详细日志)
pnpm openclaw gateway --port 18789 --verbose
```

启动成功后会显示：
```
[feishu] 长连接已建立
[gateway] listening on http://127.0.0.1:18789
```

### 第八步：验证部署

1. **飞书测试**: 在飞书中找到你的机器人，发送消息测试
2. **WebChat 测试**: 访问 `http://localhost:18789/chat?token=<你的token>`
3. **TUI 测试**: 运行 `pnpm openclaw tui`

---

## 目录结构

```
moltbot/
├── README.md                 # 本文档
├── AGENTS.md                 # 详细技术文档 (供 AI Agent 阅读)
├── TESTING-GUIDE.md          # 测试指南
│
├── openclaw/                 # OpenClaw 核心代码
│   └── [官方源码]
│
├── feishu-guide/             # 飞书集成
│   ├── README.md             # 飞书集成指南
│   ├── docs/                 # 分步文档
│   └── feishu-plugin/        # ★ 飞书插件源码
│       ├── index.ts          # 插件入口
│       └── src/
│           ├── doc-service.ts    # 云文档服务
│           ├── feishu-tools.ts   # AI工具定义
│           ├── channel.ts        # 渠道定义
│           ├── feishu-ws.ts      # 长连接处理
│           ├── send.ts           # 消息发送
│           └── sync-service.ts   # 跨渠道同步
│
├── wecom-plugin/             # 企业微信插件 (开发中)
└── mcp-ssh/                  # MCP SSH 工具
```

---

## 使用示例

### 在飞书中与 AI 对话

```
用户: 帮我创建一个文档，记录今天的会议内容

AI: ✅ 文档已创建！
    📄 标题：会议记录 - 2026-01-31
    🔗 链接：https://feishu.cn/docx/xxxxx
```

### 创建表格

```
用户: 创建一个表格，记录项目进度

AI: ✅ 表格已创建！
    📊 标题：项目进度表
    🔗 链接：https://feishu.cn/sheets/xxxxx
```

### 读取和编辑文档

```
用户: 读取刚才那个文档的内容

AI: 📄 文档内容：
    [显示文档内容]

用户: 在文档末尾追加一条"下次会议时间：周五下午3点"

AI: ✅ 内容已追加到文档！
```

---

## 常见问题

### Q: 飞书消息收不到？

1. 检查飞书开放平台权限是否全部启用
2. 确认事件订阅使用 **长连接** 模式
3. 查看 Gateway 日志中是否有 `[feishu] 长连接已建立`

### Q: 文档操作失败？

1. 确认已添加云文档相关权限
2. 检查文档 ID 是否正确（完整的27字符ID）
3. 查看 `[feishu-doc]` 开头的日志

### Q: Gateway 启动失败？

1. 检查端口 18789 是否被占用
2. 确认 Node.js 版本 >= 18
3. 尝试删除 `node_modules` 并重新 `pnpm install`

### Q: 如何持久化运行？

使用 PM2 管理进程：

```powershell
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start "pnpm openclaw gateway --port 18789" --name openclaw

# 保存配置
pm2 save
pm2 startup
```

---

## 开发指南

### 本地开发

```powershell
# 启动开发模式
cd openclaw
pnpm openclaw gateway --port 18789 --verbose
```

### 修改飞书插件

1. 编辑 `feishu-guide/feishu-plugin/src/` 下的源码
2. 同步到运行时目录：
   ```powershell
   Copy-Item "feishu-guide\feishu-plugin\src\*" `
     "$env:USERPROFILE\.openclaw\extensions\feishu\src\" -Force
   ```
3. 重启 Gateway

### 运行测试

```powershell
# 进入插件目录
cd $env:USERPROFILE\.openclaw\extensions\feishu

# 创建并运行测试脚本 (参考 TESTING-GUIDE.md)
node test-doc-crud.mjs
```

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js (TypeScript) |
| AI 模型 | 智谱 GLM-4.7 |
| 飞书 SDK | @larksuiteoapi/node-sdk v1.58.0 |
| 包管理 | pnpm |
| 版本控制 | Git + GitHub |

---

## 相关链接

- [飞书开放平台](https://open.feishu.cn/)
- [智谱 AI](https://open.bigmodel.cn/)
- [企业微信开发文档](https://developer.work.weixin.qq.com/)

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v2026.01.31.8 | 2026-01-31 | 修复表格数据写入API，添加测试指南 |
| v2026.01.31.7 | 2026-01-31 | 添加编辑、删除文档功能 |
| v2026.01.31.6 | 2026-01-31 | 添加读取、追加文档功能 |
| v2026.01.31.5 | 2026-01-31 | 实现文档权限自动授予 |

完整版本历史请查看 [AGENTS.md](./AGENTS.md)

---

## License

MIT License

---

<p align="center">
  Made with ❤️ by OpenClaw Team
</p>
