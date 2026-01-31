# Moltbot 部署：本地拉取 → 上传服务器

## 第一步：在本地（WSL）克隆并打包

在 **WSL** 终端执行（项目会克隆到 `/mnt/e/AIcode/`，打包后放在 `moltbot` 目录下方便 MCP 上传）：

```bash
cd /mnt/e/AIcode
# 克隆（浅克隆更快）
git clone --depth 1 https://github.com/moltbot/moltbot.git moltbot-repo
# 打包（排除 .git 可略减小体积，保留则便于后续 git pull）
tar czf moltbot-repo.tar.gz moltbot-repo
# 放到 moltbot 项目下，方便 MCP 上传
mv moltbot-repo.tar.gz moltbot/
```

完成后本地会有：`E:\AIcode\moltbot\moltbot-repo.tar.gz`（Windows 路径）或 `/mnt/e/AIcode/moltbot/moltbot-repo.tar.gz`（WSL 路径）。

## 第二步：上传与部署（由 AI 通过 MCP 执行）

你完成第一步后，对我说：「已经打包好了，上传并部署」。

我会：
1. 用 **ssh_upload_file** 把 `E:\AIcode\moltbot\moltbot-repo.tar.gz` 上传到服务器 `~/moltbot-repo.tar.gz`
2. 用 **ssh_execute** 在服务器上：解压、安装 pnpm、`pnpm install`、`pnpm build`、按官方文档配置并启动

## 注意

- MCP 已新增 **ssh_upload_file** 工具，需**重启 Cursor** 后生效（若刚改过 mcp-ssh 代码并 build 过）。
- 若你希望用其他路径（例如直接放在 `E:\AIcode\moltbot-repo.tar.gz`），告诉我即可，我会用对应路径上传。
