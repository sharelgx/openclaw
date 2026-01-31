#!/usr/bin/env bash
# 在 WSL 中执行：拉取 moltbot、打包、上传到服务器
# 用法：cd /mnt/e/AIcode/moltbot && chmod +x deploy-local.sh && ./deploy-local.sh
# 若出现 bad interpreter，在 WSL 里执行：sed -i 's/\r$//' deploy-local.sh

set -e
REPO_DIR="/mnt/e/AIcode/moltbot"
TAR_NAME="moltbot-repo.tar.gz"
KEY="$REPO_DIR/moltbot.pem"
REMOTE="ubuntu@111.231.75.63"

echo "==> 1/3 进入目录并克隆（浅克隆，有进度）..."
cd /mnt/e/AIcode
rm -rf moltbot-repo
git clone --progress --depth 1 https://github.com/moltbot/moltbot.git moltbot-repo

echo "==> 2/3 打包..."
tar czf "$TAR_NAME" moltbot-repo
mv "$TAR_NAME" moltbot/
echo "    已生成: moltbot/$TAR_NAME"

echo "==> 3/3 上传到服务器（有进度）..."
chmod 600 "$KEY" 2>/dev/null || true
scp -i "$KEY" -o StrictHostKeyChecking=no "$REPO_DIR/$TAR_NAME" "$REMOTE:~/"

echo "==> 完成。到 Cursor 里对 AI 说：「上传好了」，我会在服务器上解压并部署。"
