# OpenClaw 项目技术文档

> 本文档供 AI Agent 阅读，详细描述项目的整体架构、功能实现、配置说明和开发指南。

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [目录结构](#3-目录结构)
4. [核心组件](#4-核心组件)
5. [飞书插件详解](#5-飞书插件详解)
6. [配置说明](#6-配置说明)
7. [AI 工具清单](#7-ai-工具清单)
8. [API 接口](#8-api-接口)
9. [开发指南](#9-开发指南)
10. [部署说明](#10-部署说明)
11. [故障排查](#11-故障排查)
12. [版本历史](#12-版本历史)

---

## 1. 项目概述

### 1.1 项目名称
**OpenClaw** (原名 Moltbot/Clawdbot)

### 1.2 项目定位
OpenClaw 是一个 AI 个人助手平台，支持多渠道接入（飞书、企业微信、WebChat、TUI 等），提供统一的会话管理和 AI 能力。

### 1.3 核心特性
- **多渠道统一会话**：飞书、WebChat、TUI 等渠道共享同一会话上下文
- **飞书云文档集成**：AI 可直接操作飞书云文档（创建、读取、编辑、追加、删除）
- **实时消息同步**：跨渠道消息实时同步显示
- **流式响应**：支持"思考中"状态和流式回复
- **并发消息处理**：支持消息队列和并行处理

### 1.4 技术栈
- **运行时**: Node.js (TypeScript)
- **AI 模型**: GLM-4.7 (智谱 AI)
- **飞书 SDK**: @larksuiteoapi/node-sdk v1.58.0
- **包管理**: pnpm
- **版本控制**: Git + GitHub

### 1.5 当前版本
- **OpenClaw 版本**: 2026.1.29-beta.7
- **飞书插件版本**: 0.1.0
- **最新标签**: v2026.01.31.7

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户终端                                  │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   飞书 App  │  企业微信   │   WebChat   │    TUI      │  其他   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       ▼             ▼             ▼             ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Channel Manager                          ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        ││
│  │  │ Feishu  │  │ WeCom   │  │ WebChat │  │   TUI   │        ││
│  │  │ Plugin  │  │ Plugin  │  │ Channel │  │ Channel │        ││
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        ││
│  └───────┼────────────┼────────────┼────────────┼─────────────┘│
│          └────────────┴────────────┴────────────┘              │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │                    Session Manager                         │ │
│  │         (dmScope: "main" - 多渠道统一会话)                 │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │                     Agent Engine                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│  │  │   Tools     │  │   Hooks     │  │   Models    │        │ │
│  │  │ (AI 工具)   │  │ (事件钩子)  │  │ (AI 模型)   │        │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 智谱 AI API │  │ 飞书 API    │  │ 企业微信 API│              │
│  │ (GLM-4.7)   │  │ (云文档等)  │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 消息流转

```
用户发送消息 (飞书)
        │
        ▼
┌─────────────────┐
│ 飞书长连接接收  │ (feishu-ws.ts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 消息去重/合并   │ (inboundDebouncer)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 发送"思考中"卡片│ (sendThinkingStatus)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 路由到 Agent    │ (dispatcher.deliver)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI 模型处理     │ (GLM-4.7)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 流式更新消息    │ (updateMessage)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 同步到其他渠道  │ (message_sent hook)
└─────────────────┘
```

---

## 3. 目录结构

```
e:\AIcode\moltbot\
├── AGENTS.md                    # 本文档 (AI Agent 参考)
├── .gitignore                   # Git 忽略配置
├── package-lock.json            # 依赖锁定
│
├── openclaw\                    # OpenClaw 核心代码 (官方仓库克隆)
│   └── [4248 files]             # TypeScript 源码、文档等
│
├── feishu-guide\                # 飞书集成指南和插件
│   ├── README.md                # 飞书集成总览
│   ├── docs\                    # 分步文档
│   │   ├── 01-installation.md
│   │   ├── 02-model-configuration.md
│   │   ├── 03-feishu-app-setup.md
│   │   ├── 04-plugin-installation.md
│   │   ├── 05-gateway-setup.md
│   │   └── 06-troubleshooting.md
│   │
│   └── feishu-plugin\           # ★ 飞书插件源码
│       ├── index.ts             # 插件入口
│       ├── package.json         # 依赖配置
│       └── src\
│           ├── channel.ts       # 渠道定义和消息路由
│           ├── feishu-ws.ts     # 飞书长连接和消息处理
│           ├── send.ts          # 消息发送 (支持卡片、流式)
│           ├── doc-service.ts   # 云文档操作服务
│           ├── feishu-tools.ts  # AI 工具定义
│           ├── sync-service.ts  # 跨渠道同步服务
│           └── runtime.ts       # 运行时工具
│
├── wecom-plugin\                # 企业微信插件 (开发中)
│   └── [类似飞书插件结构]
│
├── mcp-ssh\                     # MCP SSH 工具
│   └── src\index.ts
│
└── wecom-callback-server\       # 企业微信回调服务器
    ├── package.json
    └── server.js
```

### 3.1 运行时目录

```
C:\Users\Administrator\.openclaw\
├── openclaw.json                # ★ 主配置文件
├── workspace\                   # AI 工作空间
├── extensions\                  # 已安装的插件
│   └── feishu\                  # 飞书插件 (运行时副本)
│       ├── index.ts
│       ├── package.json
│       └── src\
│           └── [与 feishu-guide/feishu-plugin/src 同步]
└── logs\                        # 日志文件
```

---

## 4. 核心组件

### 4.1 OpenClaw Gateway

Gateway 是 OpenClaw 的核心服务，负责：
- 管理所有渠道连接
- 路由消息到正确的 Agent
- 管理会话状态
- 调度 AI 模型

**启动命令**:
```bash
cd e:\AIcode\moltbot\openclaw
pnpm openclaw gateway --port 18789 --verbose
```

**默认端口**: 18789

### 4.2 Session Manager

会话管理器负责：
- 维护用户会话状态
- 支持多渠道统一会话 (`dmScope: "main"`)
- 会话历史存储和检索

**配置** (`openclaw.json`):
```json
{
  "session": {
    "dmScope": "main"  // 所有 DM 共享同一会话
  }
}
```

### 4.3 Agent Engine

Agent 引擎是 AI 处理核心：
- 调用 AI 模型生成回复
- 管理工具调用
- 处理并发请求

**配置**:
```json
{
  "agents": {
    "defaults": {
      "maxConcurrent": 4,
      "model": {
        "primary": "zai/glm-4.7"
      }
    }
  }
}
```

---

## 5. 飞书插件详解

### 5.1 插件结构

```typescript
// index.ts - 插件入口
const plugin = {
  id: "feishu",
  name: "飞书",
  description: "飞书频道插件，支持长连接和云文档",
  
  register(api: OpenClawPluginApi) {
    // 1. 注册渠道
    api.registerChannel({ plugin: feishuPlugin });
    
    // 2. 注册 AI 工具
    api.registerTool(...);
    
    // 3. 注册消息钩子
    api.registerHook("message_sent", ...);
  }
};
```

### 5.2 核心文件说明

#### 5.2.1 `channel.ts` - 渠道定义

```typescript
export const feishuPlugin: ChannelPlugin<FeishuAccount> = {
  id: "feishu",
  displayName: "飞书",
  
  // 入站消息处理
  inbound: { ... },
  
  // 出站消息处理
  outbound: {
    deliveryMode: "eager",
    sendText: async (to, text, opts) => { ... },
    sendMedia: async (to, media, opts) => { ... },
    resolveTarget: (account, route) => { ... },
  },
  
  // 账户解析
  resolveAccount: (accountId, config) => { ... },
  
  // 启动连接
  start: async (ctx) => { ... },
};
```

#### 5.2.2 `feishu-ws.ts` - 长连接处理

核心功能：
- 建立飞书 WebSocket 长连接
- 接收和解析消息事件
- 消息去重和合并 (debounce)
- 发送"思考中"状态
- 流式更新回复

关键代码片段：
```typescript
// 消息去重器
const inboundDebouncer = core.channel.debounce.createInboundDebouncer<FeishuMessageEntry>({
  debounceMs: Math.min(inboundDebounceMs, 500),
  buildKey: (entry) => `feishu:${ctx.accountId}:${entry.chatId}:${entry.senderId}`,
  onFlush: async (entries) => {
    // 发送"思考中"状态
    const { messageId, client } = await sendThinkingStatus(to, { cfg, accountId: ctx.accountId });
    
    // 路由到 Agent，支持流式更新
    const route = await core.channel.dispatcher.deliver(message, {
      ...
    });
  },
});
```

#### 5.2.3 `send.ts` - 消息发送

支持的消息类型：
- 纯文本消息
- 交互式卡片 (Markdown 内容)
- 流式更新消息

关键函数：
```typescript
// 发送消息
export async function sendMessageFeishu(to: string, text: string, opts?: SendOptions): Promise<SendResult>

// 发送"思考中"状态
export async function sendThinkingStatus(to: string, opts?: { cfg?: OpenClawConfig; accountId?: string }): Promise<{ messageId: string; client: Lark.Client }>

// 更新消息 (流式)
export async function updateMessage(client: Lark.Client, messageId: string, text: string, isStreaming: boolean = true): Promise<void>
```

#### 5.2.4 `doc-service.ts` - 云文档服务

提供的文档操作：
```typescript
// 创建文档
export async function createDocument(cfg, title, content, folderToken?): Promise<CreateDocResult>

// 读取文档
export async function readDocument(cfg, documentId): Promise<{ success: boolean; content?: string; error?: string }>

// 追加内容
export async function appendToDocument(cfg, documentId, content): Promise<{ success: boolean; error?: string }>

// 编辑文档 (替换内容)
export async function editDocument(cfg, documentId, newContent): Promise<{ success: boolean; error?: string }>

// 删除文件
export async function deleteFile(cfg, fileToken, fileType): Promise<{ success: boolean; error?: string }>

// 创建表格
export async function createSpreadsheet(cfg, title, data?): Promise<{ success: boolean; spreadsheetToken?: string; url?: string; error?: string }>

// 列出文件夹
export async function listFolders(cfg, folderToken?): Promise<{ success: boolean; folders?: Array<{ token: string; name: string }>; error?: string }>

// 保存到每日文档
export async function saveToDailyDocument(cfg, content, folderToken?): Promise<CreateDocResult>
```

#### 5.2.5 `feishu-tools.ts` - AI 工具定义

使用 `@sinclair/typebox` 定义工具参数：

```typescript
export function createSaveToFeishuDocTool() {
  return {
    name: "save_to_feishu_doc",
    description: "将内容保存到飞书云文档...",
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "文档标题" })),
      content: Type.String({ description: "文档内容" }),
      mode: Type.Unsafe<"new" | "daily">({ ... }),
      folderToken: Type.Optional(Type.String({ ... })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      // 执行逻辑
      return {
        content: [{ type: "text", text: "结果文本" }],
        details: { success: true, ... },
      };
    },
  };
}
```

#### 5.2.6 `sync-service.ts` - 跨渠道同步

维护活跃飞书聊天状态，支持跨渠道消息同步：

```typescript
// 设置活跃聊天
export function setActiveFeishuChat(chatId: string, userId: string): void

// 获取活跃聊天
export function getActiveFeishuChat(): { chatId: string; userId: string } | null

// 同步消息到飞书
export async function syncMessageToFeishu(content: string): Promise<void>
```

---

## 6. 配置说明

### 6.1 主配置文件

**位置**: `C:\Users\Administrator\.openclaw\openclaw.json`

**完整配置**:
```json
{
  "session": {
    "dmScope": "main"           // 多渠道共享会话
  },
  "messages": {
    "ackReactionScope": "group-mentions"
  },
  "agents": {
    "defaults": {
      "maxConcurrent": 4,       // 最大并发数
      "subagents": {
        "maxConcurrent": 8
      },
      "compaction": {
        "mode": "safeguard"
      },
      "workspace": "C:\\Users\\Administrator\\.openclaw\\workspace",
      "models": {
        "zai/glm-4.7": {
          "alias": "GLM"
        }
      },
      "model": {
        "primary": "zai/glm-4.7"  // 主要 AI 模型
      }
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "aa3eeb3a837b203d4231d41c6fd13d5c6cfa83b025fe3697"  // Gateway Token
    },
    "port": 18789,              // Gateway 端口
    "bind": "loopback"
  },
  "auth": {
    "profiles": {
      "zai:default": {
        "provider": "zai",
        "mode": "api_key"
      }
    }
  },
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
      "appId": "cli_a9f7f2295638dbb6",           // 飞书 App ID
      "appSecret": "4pZwZnyOLpdlCuHEKS2RufCwkaSfI4Sl",  // 飞书 App Secret
      "dmPolicy": "open",       // 允许所有 DM
      "allowFrom": ["*"],       // 允许所有用户
      "useCard": true           // 使用卡片消息
    }
  }
}
```

### 6.2 飞书开放平台配置

**必需权限**:
| 权限 | 用途 |
|-----|------|
| `im:message` | 接收消息 |
| `im:message:send_as_bot` | 发送消息 |
| `im:chat:readonly` | 读取群信息 |
| `contact:user.id:readonly` | 读取用户 ID |
| `docx:document:create` | 创建文档 |
| `docx:document:readonly` | 读取文档 |
| `sheets:spreadsheet` | 操作表格 |
| `drive:drive:readonly` | 读取云空间 |
| `drive:file` | 文件操作 |

**事件订阅**:
- 接收消息: `im.message.receive_v1`
- 订阅方式: 使用长连接 (Persistent Connection)

---

## 7. AI 工具清单

### 7.1 飞书文档工具

| 工具名称 | 功能描述 | 参数 |
|---------|---------|------|
| `save_to_feishu_doc` | 创建新文档或保存到每日文档 | `title`, `content`, `mode`, `folderToken` |
| `read_feishu_doc` | 读取文档内容 | `documentId` |
| `append_to_feishu_doc` | 在文档末尾追加内容 | `documentId`, `content` |
| `edit_feishu_doc` | 替换文档全部内容 | `documentId`, `newContent` |
| `delete_feishu_file` | 删除文档/表格 | `fileToken`, `fileType` |
| `create_feishu_sheet` | 创建电子表格 | `title`, `data` |
| `list_feishu_folders` | 列出云空间文件夹 | `folderToken` |

### 7.2 工具调用示例

**用户**: "帮我创建一个文档，标题是会议纪要，内容是今天讨论了项目进度"

**AI 调用**:
```json
{
  "tool": "save_to_feishu_doc",
  "params": {
    "title": "会议纪要",
    "content": "今天讨论了项目进度",
    "mode": "new"
  }
}
```

**返回**:
```json
{
  "content": [{ "type": "text", "text": "✅ 文档已创建！\n📄 标题：会议纪要\n🔗 链接：https://feishu.cn/docx/ABC123" }],
  "details": { "success": true, "url": "https://feishu.cn/docx/ABC123", "documentId": "ABC123" }
}
```

---

## 8. API 接口

### 8.1 飞书 SDK API

使用 `@larksuiteoapi/node-sdk` v1.58.0

**客户端初始化**:
```typescript
import * as Lark from "@larksuiteoapi/node-sdk";

const client = new Lark.Client({
  appId: "your_app_id",
  appSecret: "your_app_secret",
  appType: Lark.AppType.SelfBuild,
  domain: Lark.Domain.Feishu,
});
```

**常用 API**:
```typescript
// 发送消息
client.im.message.create({ params, data })

// 更新消息
client.im.message.patch({ path, data })

// 创建文档
client.docx.document.create({ data })

// 读取文档
client.docx.document.rawContent({ path })

// 追加内容到文档
client.docx.documentBlockChildren.create({ path, params, data })

// 删除文件
client.drive.file.delete({ path, params })

// 授予权限
client.drive.permissionMember.create({ path, params, data })
```

### 8.2 OpenClaw Plugin API

```typescript
interface OpenClawPluginApi {
  // 注册渠道
  registerChannel(options: { plugin: ChannelPlugin }): void;
  
  // 注册工具
  registerTool(factory: (ctx) => Tool, options: { names: string[] }): void;
  
  // 注册钩子
  registerHook(event: string, handler: Function, options: { name: string }): void;
  
  // 日志
  logger: {
    info(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
  };
  
  // 运行时
  runtime: OpenClawRuntime;
}
```

---

## 9. 开发指南

### 9.1 环境准备

```bash
# 1. 安装 Node.js 18+
# 2. 安装 pnpm
npm install -g pnpm

# 3. 克隆项目
git clone https://github.com/sharelgx/openclaw.git
cd openclaw

# 4. 安装依赖
cd openclaw
pnpm install
```

### 9.2 本地开发

```bash
# 启动 Gateway (带详细日志)
pnpm openclaw gateway --port 18789 --verbose

# 启动 TUI (终端界面)
pnpm openclaw tui

# 访问 WebChat
# http://localhost:18789/chat?token=YOUR_GATEWAY_TOKEN
```

### 9.3 插件开发

1. **在开发目录修改代码**:
   ```
   e:\AIcode\moltbot\feishu-guide\feishu-plugin\src\
   ```

2. **同步到运行时目录**:
   ```powershell
   Copy-Item "e:\AIcode\moltbot\feishu-guide\feishu-plugin\src\*" "C:\Users\Administrator\.openclaw\extensions\feishu\src\" -Force
   Copy-Item "e:\AIcode\moltbot\feishu-guide\feishu-plugin\index.ts" "C:\Users\Administrator\.openclaw\extensions\feishu\" -Force
   ```

3. **重启 Gateway**:
   ```bash
   # 停止旧进程
   Get-Process -Name "node" | Stop-Process -Force
   
   # 启动新进程
   pnpm openclaw gateway --port 18789 --verbose
   ```

### 9.4 测试

```bash
# 创建测试脚本
cd C:\Users\Administrator\.openclaw\extensions\feishu
node test-xxx.mjs

# 测试完成后删除
Remove-Item test-*.mjs -Force
```

### 9.5 提交代码

```bash
cd e:\AIcode\moltbot
git add .
git commit -m "feat(feishu): 描述你的修改"
git push
git tag vYYYY.MM.DD.N
git push origin vYYYY.MM.DD.N
```

---

## 10. 部署说明

### 10.1 本地部署 (Windows)

```powershell
# 1. 进入 OpenClaw 目录
cd e:\AIcode\moltbot\openclaw

# 2. 启动 Gateway
pnpm openclaw gateway --port 18789 --verbose

# 3. Gateway 会自动：
#    - 加载飞书插件
#    - 连接飞书长连接
#    - 启动 WebChat 服务
```

### 10.2 访问方式

| 渠道 | 访问方式 |
|-----|---------|
| 飞书 | 在飞书 App 中与机器人对话 |
| WebChat | http://localhost:18789/chat?token=YOUR_TOKEN |
| TUI | `pnpm openclaw tui` |

### 10.3 持久化运行

Windows 下可使用 PM2 或注册为服务：
```powershell
# 使用 PM2
npm install -g pm2
pm2 start "pnpm openclaw gateway --port 18789" --name openclaw
pm2 save
pm2 startup
```

---

## 11. 故障排查

### 11.1 常见问题

#### 飞书消息收不到
1. 检查飞书开放平台权限是否全部启用
2. 确认事件订阅使用"长连接"模式
3. 查看 Gateway 日志中是否有 `[feishu] 长连接已建立`

#### 文档操作失败 (400/404)
1. 确认文档 ID 完整 (27 字符)
2. 检查是否有云文档相关权限
3. 查看日志中的具体错误信息

#### Gateway 崩溃
1. 检查是否有 `mdns` 或 `WebSocket` 相关错误
2. 插件已添加全局错误处理，应该不会崩溃
3. 如仍崩溃，检查 `index.ts` 中的错误处理代码

### 11.2 日志位置

- **Gateway 日志**: 终端输出 (启动时加 `--verbose`)
- **插件日志**: 以 `[feishu]` 或 `[feishu-doc]` 开头

### 11.3 调试技巧

```typescript
// 在代码中添加日志
console.log(`[feishu-debug] 参数: ${JSON.stringify(params)}`);
```

---

## 12. 版本历史

### v2026.01.31.7 (最新)
- ✅ 添加编辑文档功能 (`edit_feishu_doc`)
- ✅ 确认删除文档功能正常 (`delete_feishu_file`)
- ✅ 全部 5 项文档功能测试通过

### v2026.01.31.6
- ✅ 修复追加内容 API (`documentBlockChildren.create`)
- ✅ 添加读取文档工具 (`read_feishu_doc`)
- ✅ 添加追加内容工具 (`append_to_feishu_doc`)
- ✅ 添加删除文档工具 (`delete_feishu_file`)
- ✅ 修复 block 格式和 index 参数

### v2026.01.31.5
- ✅ 实现文档权限自动授予 (`permissionMember.create`)
- ✅ 修复用户无法编辑机器人创建的文档问题

### v2026.01.31.4
- ✅ 实现消息并发处理队列
- ✅ 添加"排队中"提示

### v2026.01.31.3
- ✅ 实现流式响应 (Streaming)
- ✅ 添加"思考中"状态卡片
- ✅ 使用消息更新 API 实现实时显示

### v2026.01.31.2
- ✅ 实现交互式卡片消息
- ✅ 添加按钮选项 (静态文本模式)

### v2026.01.31.1
- ✅ 初始化 GitHub 仓库
- ✅ 实现基础飞书消息收发
- ✅ 实现多渠道会话合并

---

## 附录

### A. 相关链接

- **GitHub 仓库**: https://github.com/sharelgx/openclaw
- **飞书开放平台**: https://open.feishu.cn/
- **智谱 AI**: https://open.bigmodel.cn/

### B. 联系方式

项目维护者可通过 GitHub Issues 联系。

---

*文档最后更新: 2026-01-31*
*文档版本: 1.0*
