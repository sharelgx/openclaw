# MCP SSH 连接工具

通过 MCP (Model Context Protocol) 在远程服务器上执行命令。配置到 Cursor 后，AI 可以直接调用工具连接你的服务器并执行命令，无需在终端里手动 SSH。

## 功能

- **ssh_execute**：在远程服务器上执行一条 Shell 命令（支持私钥或密码）
- **ssh_ls**：列出远程目录（相当于 `ls -la`）

## 环境要求

- Node.js 18+
- 已安装 npm

## 安装与构建

```bash
cd mcp-ssh
npm install
npm run build
```

## 在 Cursor 中配置 MCP

1. 打开 Cursor 的 MCP 配置文件：
   - **Windows**：`%USERPROFILE%\.cursor\config\mcp.json`
   - **macOS/Linux**：`~/.cursor/config/mcp.json`

2. 若文件不存在，先创建并写入：

```json
{
  "mcpServers": {
    "mcp-ssh": {
      "command": "node",
      "args": ["E:/AIcode/moltbot/mcp-ssh/build/index.js"]
    }
  }
}
```

3. 将 `args` 里的路径改成你本机 **moltbot 项目** 下 `mcp-ssh/build/index.js` 的**绝对路径**（Windows 可用 `/` 或 `\\`）。

4. 保存后**完全重启 Cursor**，使 MCP 生效。

## 使用方式

配置完成后，在对话中可以让 AI：

- 使用 **ssh_execute** 在服务器上执行命令，例如：
  - 主机：`111.231.75.63`
  - 用户：`ubuntu`
  - 私钥：`E:\AIcode\moltbot\moltbot.pem`
  - 命令：`whoami`、`ls -la`、`df -h` 等

- 使用 **ssh_ls** 列出远程目录。

AI 会通过 MCP 调用这些工具，在**独立进程**中完成 SSH 连接与执行，不受 Cursor 沙箱/管理员限制。

## 安全说明

- 私钥和密码通过工具参数传入，**不要**在对话中明文写密码；建议只用私钥。
- 私钥路径建议使用本机绝对路径（如 `E:\AIcode\moltbot\moltbot.pem`）。

## 本地测试（可选）

```bash
cd mcp-ssh
npm run build
node build/index.js
```

进程会通过 stdio 等待 MCP 客户端连接；用 Cursor 连接后即可在对话中让 AI 调用工具。
