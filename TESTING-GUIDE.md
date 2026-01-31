# OpenClaw 智能文档/表格测试指南

> 本文档供 AI Agent（小元）阅读，详细说明如何测试飞书和企业微信的智能文档、表格功能。

---

## 目录

1. [概述](#1-概述)
2. [飞书文档/表格工具](#2-飞书文档表格工具)
3. [企业微信文档/表格工具](#3-企业微信文档表格工具)
4. [目录结构](#4-目录结构)
5. [回归测试方法](#5-回归测试方法)
6. [自我修复流程](#6-自我修复流程)
7. [常见问题排查](#7-常见问题排查)

---

## 1. 概述

### 1.1 测试范围

| 平台 | 文档功能 | 表格功能 | 状态 |
|------|---------|---------|------|
| 飞书 | 创建、读取、追加、编辑、删除 | 创建、写入、删除 | ✅ 已实现 |
| 企业微信 | 待实现 | 待实现 | 🚧 开发中 |

### 1.2 测试环境

- **运行时目录**: `C:\Users\Administrator\.openclaw\`
- **配置文件**: `C:\Users\Administrator\.openclaw\openclaw.json`
- **开发目录**: `e:\AIcode\moltbot\`

---

## 2. 飞书文档/表格工具

### 2.1 工具清单

| 工具名称 | 功能 | 对应函数 |
|---------|------|---------|
| `save_to_feishu_doc` | 创建新文档或保存到每日文档 | `createDocument()`, `saveToDailyDocument()` |
| `read_feishu_doc` | 读取文档内容 | `readDocument()` |
| `append_to_feishu_doc` | 追加内容到文档末尾 | `appendToDocument()` |
| `edit_feishu_doc` | 替换文档全部内容 | `editDocument()` |
| `delete_feishu_file` | 删除文档或表格 | `deleteFile()` |
| `create_feishu_sheet` | 创建电子表格 | `createSpreadsheet()` |
| `list_feishu_folders` | 列出云空间文件夹 | `listFolders()` |

### 2.2 源代码位置

```
开发目录:
e:\AIcode\moltbot\feishu-guide\feishu-plugin\
├── index.ts                 # 插件入口，注册工具
├── src\
│   ├── doc-service.ts       # ★ 核心：文档/表格服务实现
│   ├── feishu-tools.ts      # ★ 核心：AI工具定义
│   ├── channel.ts           # 渠道定义
│   ├── feishu-ws.ts         # 长连接处理
│   ├── send.ts              # 消息发送
│   └── sync-service.ts      # 跨渠道同步

运行时目录 (Gateway 实际加载):
C:\Users\Administrator\.openclaw\extensions\feishu\
├── index.ts
└── src\
    └── [与开发目录相同]
```

### 2.3 工具调用方法

#### 2.3.1 创建文档 (`save_to_feishu_doc`)

```javascript
// 参数
{
  title: "文档标题",           // 可选，创建新文档时使用
  content: "文档内容",         // 必填，支持 Markdown
  mode: "new" | "daily",      // new=新建, daily=每日文档
  folderToken: "fldcnXXX"     // 可选，指定文件夹
}

// 返回
{
  success: true,
  documentId: "ABC123",
  url: "https://feishu.cn/docx/ABC123"
}
```

#### 2.3.2 读取文档 (`read_feishu_doc`)

```javascript
// 参数
{
  documentId: "ABC123"        // 从URL获取，如 https://feishu.cn/docx/ABC123
}

// 返回
{
  success: true,
  content: "文档纯文本内容"
}
```

#### 2.3.3 追加内容 (`append_to_feishu_doc`)

```javascript
// 参数
{
  documentId: "ABC123",
  content: "要追加的内容"     // 会自动添加时间戳分隔
}

// 返回
{
  success: true
}
```

#### 2.3.4 编辑文档 (`edit_feishu_doc`)

```javascript
// 参数
{
  documentId: "ABC123",
  newContent: "新的完整内容"  // 替换整个文档
}

// 返回
{
  success: true
}
```

#### 2.3.5 删除文件 (`delete_feishu_file`)

```javascript
// 参数
{
  fileToken: "ABC123",
  fileType: "docx" | "sheet" | "file" | "folder"
}

// 返回
{
  success: true
}
```

#### 2.3.6 创建表格 (`create_feishu_sheet`)

```javascript
// 参数
{
  title: "表格标题",
  data: [                     // 可选，二维数组
    ["姓名", "年龄", "城市"],
    ["张三", "25", "北京"]
  ]
}

// 返回
{
  success: true,
  spreadsheetToken: "XXX",
  url: "https://feishu.cn/sheets/XXX"
}
```

#### 2.3.7 列出文件夹 (`list_feishu_folders`)

```javascript
// 参数
{
  folderToken: "fldcnXXX"     // 可选，为空则列出根目录
}

// 返回
{
  success: true,
  folders: [
    { token: "fldcn123", name: "文件夹名" }
  ]
}
```

### 2.4 底层 API 说明

飞书 SDK 使用 `@larksuiteoapi/node-sdk` v1.58.0

```javascript
import * as Lark from "@larksuiteoapi/node-sdk";

const client = new Lark.Client({
  appId: "cli_xxx",
  appSecret: "xxx",
  appType: Lark.AppType.SelfBuild,
  domain: Lark.Domain.Feishu,
});

// 文档 API
client.docx.document.create()              // 创建文档
client.docx.document.get()                 // 获取文档信息
client.docx.document.rawContent()          // 读取文档内容
client.docx.documentBlock.list()           // 列出文档块
client.docx.documentBlockChildren.create() // 添加内容块
client.docx.documentBlockChildren.batchDelete() // 删除内容块

// 表格 API
client.sheets.spreadsheet.create()         // 创建表格
client.sheets.spreadsheetSheet.query()     // 获取工作表信息 (含 sheetId)
client.request({                           // 写入数据 (REST API)
  method: "PUT",
  url: `/open-apis/sheets/v2/spreadsheets/${token}/values`,
  data: { valueRange: { range, values } }
})

// 云空间 API
client.drive.file.list()                   // 列出文件
client.drive.file.delete()                 // 删除文件
client.drive.permissionMember.create()     // 授权
```

---

## 3. 企业微信文档/表格工具

### 3.1 当前状态

🚧 **开发中** - 企业微信消息通道已实现，文档/表格功能待开发。

### 3.2 预期工具清单

| 工具名称 | 功能 | 状态 |
|---------|------|------|
| `save_to_wecom_doc` | 创建企微文档 | 待实现 |
| `read_wecom_doc` | 读取企微文档 | 待实现 |
| `create_wecom_sheet` | 创建企微表格 | 待实现 |

### 3.3 源代码位置

```
e:\AIcode\moltbot\wecom-plugin\
├── index.ts
└── src\
    ├── channel.ts
    ├── wecom-ws.ts
    └── [待添加 doc-service.ts]
```

### 3.4 企业微信 API 参考

企业微信文档 API 需要使用 `@wecom/wedoc-js-sdk` 或直接调用 REST API：

```
// 文档 API
POST /cgi-bin/wedoc/create_doc
POST /cgi-bin/wedoc/get_doc_info
POST /cgi-bin/wedoc/doc_get_content

// 表格 API  
POST /cgi-bin/wedoc/spreadsheet/spreadsheet_add_sheet
POST /cgi-bin/wedoc/spreadsheet/batch_update
```

---

## 4. 目录结构

### 4.1 完整项目结构

```
e:\AIcode\moltbot\                    # 项目根目录
├── AGENTS.md                         # 项目技术文档
├── TESTING-GUIDE.md                  # 本测试指南
├── WECOM-INTEGRATION.md              # 企微集成文档
│
├── openclaw\                         # OpenClaw 核心 (官方仓库)
│   └── [源码]
│
├── feishu-guide\                     # 飞书集成
│   ├── README.md
│   ├── docs\                         # 文档
│   └── feishu-plugin\                # ★ 飞书插件源码
│       ├── index.ts
│       ├── package.json
│       └── src\
│           ├── doc-service.ts        # 文档服务
│           ├── feishu-tools.ts       # AI工具
│           ├── channel.ts
│           ├── feishu-ws.ts
│           ├── send.ts
│           └── sync-service.ts
│
├── wecom-plugin\                     # 企微插件
│   └── [开发中]
│
└── wecom-callback-server\            # 企微回调服务
    └── server.js

C:\Users\Administrator\.openclaw\     # 运行时目录
├── openclaw.json                     # ★ 主配置文件
├── extensions\
│   ├── feishu\                       # 飞书插件 (运行时)
│   │   ├── index.ts
│   │   └── src\
│   └── wecom\                        # 企微插件 (运行时)
└── workspace\                        # AI 工作空间
```

### 4.2 配置文件结构

```json
// C:\Users\Administrator\.openclaw\openclaw.json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx"
    },
    "wecom": {
      "enabled": true,
      "corpId": "wwd942xxx",
      "corpSecret": "xxx",
      "agentId": "1000004"
    }
  },
  "plugins": {
    "entries": {
      "feishu": { "enabled": true },
      "wecom": { "enabled": true }
    }
  }
}
```

---

## 5. 回归测试方法

### 5.1 创建测试脚本

在运行时目录创建测试脚本：

```javascript
// C:\Users\Administrator\.openclaw\extensions\feishu\test-doc-crud.mjs

import * as Lark from "@larksuiteoapi/node-sdk";
import fs from "fs";

// 读取配置
const config = JSON.parse(fs.readFileSync(
  "C:\\Users\\Administrator\\.openclaw\\openclaw.json", "utf-8"
));
const feishuConfig = config.channels.feishu;

// 初始化客户端
const client = new Lark.Client({
  appId: feishuConfig.appId,
  appSecret: feishuConfig.appSecret,
  appType: Lark.AppType.SelfBuild,
  domain: Lark.Domain.Feishu,
});

// 测试用例
async function runTests() {
  const results = [];
  let docId = null;
  let sheetToken = null;

  // 测试1: 创建文档
  try {
    const res = await client.docx.document.create({
      data: { title: `测试文档-${Date.now()}`, folder_token: "" },
    });
    docId = res.data?.document?.document_id;
    results.push({ test: "创建文档", pass: res.code === 0, id: docId });
  } catch (e) {
    results.push({ test: "创建文档", pass: false, error: e.message });
  }

  // 测试2: 读取文档
  if (docId) {
    try {
      const res = await client.docx.document.rawContent({
        path: { document_id: docId },
      });
      results.push({ test: "读取文档", pass: res.code === 0 });
    } catch (e) {
      results.push({ test: "读取文档", pass: false, error: e.message });
    }
  }

  // 测试3: 追加内容
  if (docId) {
    try {
      const res = await client.docx.documentBlockChildren.create({
        path: { document_id: docId, block_id: docId },
        params: { document_revision_id: -1 },
        data: {
          children: [{
            block_type: 2,
            text: { elements: [{ text_run: { content: "追加测试" } }] },
          }],
          index: -1,
        },
      });
      results.push({ test: "追加内容", pass: res.code === 0 });
    } catch (e) {
      results.push({ test: "追加内容", pass: false, error: e.message });
    }
  }

  // 测试4: 编辑文档 (获取blocks -> 删除 -> 添加新内容)
  if (docId) {
    try {
      // 获取blocks
      const blocksRes = await client.docx.documentBlock.list({
        path: { document_id: docId },
        params: { page_size: 500, document_revision_id: -1 },
      });
      const contentBlocks = (blocksRes.data?.items || [])
        .filter(b => b.block_type >= 2 && b.block_type <= 15);
      
      // 删除旧内容
      if (contentBlocks.length > 0) {
        await client.docx.documentBlockChildren.batchDelete({
          path: { document_id: docId, block_id: docId },
          params: { document_revision_id: -1 },
          data: { start_index: 0, end_index: contentBlocks.length },
        });
      }
      
      // 添加新内容
      await client.docx.documentBlockChildren.create({
        path: { document_id: docId, block_id: docId },
        params: { document_revision_id: -1 },
        data: {
          children: [{
            block_type: 2,
            text: { elements: [{ text_run: { content: "编辑后的内容" } }] },
          }],
          index: 0,
        },
      });
      results.push({ test: "编辑文档", pass: true });
    } catch (e) {
      results.push({ test: "编辑文档", pass: false, error: e.message });
    }
  }

  // 测试5: 删除文档
  if (docId) {
    try {
      const res = await client.drive.file.delete({
        path: { file_token: docId },
        params: { type: "docx" },
      });
      results.push({ test: "删除文档", pass: res.code === 0 });
      docId = null;
    } catch (e) {
      results.push({ test: "删除文档", pass: false, error: e.message });
    }
  }

  // 测试6: 创建表格
  try {
    const res = await client.sheets.spreadsheet.create({
      data: { title: `测试表格-${Date.now()}` },
    });
    sheetToken = res.data?.spreadsheet?.spreadsheet_token;
    results.push({ test: "创建表格", pass: res.code === 0, token: sheetToken });
  } catch (e) {
    results.push({ test: "创建表格", pass: false, error: e.message });
  }

  // 测试7: 写入表格数据
  if (sheetToken) {
    try {
      // 获取 sheetId
      const queryRes = await client.sheets.spreadsheetSheet.query({
        path: { spreadsheet_token: sheetToken },
      });
      const sheetId = queryRes.data?.sheets?.[0]?.sheet_id;
      
      // 写入数据 (使用 REST API)
      const res = await client.request({
        method: "PUT",
        url: `/open-apis/sheets/v2/spreadsheets/${sheetToken}/values`,
        data: {
          valueRange: {
            range: `${sheetId}!A1:C2`,
            values: [["A", "B", "C"], ["1", "2", "3"]],
          },
        },
      });
      results.push({ test: "写入表格", pass: res.code === 0 });
    } catch (e) {
      results.push({ test: "写入表格", pass: false, error: e.message });
    }
  }

  // 测试8: 删除表格
  if (sheetToken) {
    try {
      const res = await client.drive.file.delete({
        path: { file_token: sheetToken },
        params: { type: "sheet" },
      });
      results.push({ test: "删除表格", pass: res.code === 0 });
    } catch (e) {
      results.push({ test: "删除表格", pass: false, error: e.message });
    }
  }

  // 测试9: 列出文件夹
  try {
    const res = await client.drive.file.list({
      params: { folder_token: "", page_size: 50 },
    });
    results.push({ test: "列出文件夹", pass: res.code === 0 });
  } catch (e) {
    results.push({ test: "列出文件夹", pass: false, error: e.message });
  }

  // 输出结果
  console.log("\n========== 测试结果 ==========");
  results.forEach(r => {
    const icon = r.pass ? "✅" : "❌";
    console.log(`${icon} ${r.test}${r.error ? ": " + r.error : ""}`);
  });
  
  const passed = results.filter(r => r.pass).length;
  console.log(`\n总计: ${passed}/${results.length} 通过`);
  
  return passed === results.length;
}

runTests().then(success => process.exit(success ? 0 : 1));
```

### 5.2 运行测试

```powershell
# 进入插件目录
cd C:\Users\Administrator\.openclaw\extensions\feishu

# 运行测试
node test-doc-crud.mjs

# 测试完成后删除脚本
Remove-Item test-*.mjs -Force
```

### 5.3 测试检查清单

| # | 测试项 | 预期结果 |
|---|--------|---------|
| 1 | 创建文档 | 返回 documentId |
| 2 | 读取文档 | 返回文档内容 |
| 3 | 追加内容 | code === 0 |
| 4 | 编辑文档 | code === 0 |
| 5 | 删除文档 | code === 0 |
| 6 | 创建表格 | 返回 spreadsheetToken |
| 7 | 写入表格 | code === 0 |
| 8 | 删除表格 | code === 0 |
| 9 | 列出文件夹 | code === 0 |

---

## 6. 自我修复流程

### 6.1 修复步骤

当测试失败时，按以下流程自我修复：

```
1. 分析错误
   ↓
2. 定位问题代码
   ↓
3. 修复代码
   ↓
4. 同步到运行时
   ↓
5. 重新测试
   ↓
6. 更新文档
```

### 6.2 常见错误及修复

#### 错误1: API 方法不存在

```
错误: Cannot read properties of undefined (reading 'xxx')
原因: SDK 中没有该方法
修复: 使用 client.request() 直接调用 REST API
```

#### 错误2: 返回结构变化

```
错误: 未获取到 xxx
原因: API 返回结构与预期不同
修复: 
  1. 创建调试脚本打印实际返回
  2. 根据实际结构修改代码
```

#### 错误3: 权限不足

```
错误: code: 99991663/99991664
原因: 缺少 API 权限
修复: 在飞书开放平台添加对应权限
```

### 6.3 代码修复示例

```powershell
# 1. 修改开发目录代码
# 编辑 e:\AIcode\moltbot\feishu-guide\feishu-plugin\src\doc-service.ts

# 2. 同步到运行时目录
Copy-Item "e:\AIcode\moltbot\feishu-guide\feishu-plugin\src\*" `
  "C:\Users\Administrator\.openclaw\extensions\feishu\src\" -Force

# 3. 重新测试
cd C:\Users\Administrator\.openclaw\extensions\feishu
node test-doc-crud.mjs

# 4. 如果测试通过，更新文档
# 编辑 AGENTS.md 的版本历史
```

### 6.4 调试技巧

```javascript
// 1. 打印完整返回结构
console.log(JSON.stringify(response, null, 2));

// 2. 列出 SDK 命名空间
console.log(Object.keys(client.sheets));

// 3. 捕获详细错误
try {
  // API 调用
} catch (e) {
  console.log("错误详情:", e.response?.data || e.message);
}
```

---

## 7. 常见问题排查

### 7.1 飞书 API 错误码

| 错误码 | 含义 | 解决方案 |
|-------|------|---------|
| 0 | 成功 | - |
| 99991663 | 无权限 | 添加 API 权限 |
| 99991664 | 无文档权限 | 使用 permissionMember.create 授权 |
| 400 | 参数错误 | 检查参数格式 |
| 404 | 资源不存在 | 检查 ID 是否正确 |

### 7.2 SDK 版本问题

```bash
# 检查 SDK 版本
cd C:\Users\Administrator\.openclaw\extensions\feishu
npm ls @larksuiteoapi/node-sdk

# 预期版本: 1.58.0
```

### 7.3 配置检查

```powershell
# 检查配置文件
Get-Content C:\Users\Administrator\.openclaw\openclaw.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 7.4 日志查看

```powershell
# 启动 Gateway 时加 --verbose
cd e:\AIcode\moltbot\openclaw
pnpm openclaw gateway --port 18789 --verbose

# 查看飞书相关日志
# [feishu] 开头的日志
# [feishu-doc] 开头的日志
```

---

## 附录

### A. 飞书权限清单

```
im:message                    # 消息
im:message:send_as_bot       # 发送消息
im:chat:readonly             # 群信息
contact:user.id:readonly     # 用户ID
docx:document:create         # 创建文档
docx:document:readonly       # 读取文档
sheets:spreadsheet           # 表格
drive:drive:readonly         # 云空间
drive:file                   # 文件操作
```

### B. 企业微信权限清单

```
# 待补充
```

### C. 相关文档链接

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [飞书 Node.js SDK](https://github.com/larksuite/node-sdk)
- [企业微信开发文档](https://developer.work.weixin.qq.com/document/)

---

*文档最后更新: 2026-01-31*
*版本: 1.0*
