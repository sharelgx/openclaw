#!/bin/bash

# 飞书插件安装脚本
# 单独安装或更新飞书插件

set -e

echo "================================================"
echo "📦 飞书插件安装脚本"
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 检查插件目录是否存在
if [ ! -d "$SCRIPT_DIR/feishu-plugin" ]; then
    echo -e "${RED}✗ 错误：找不到插件目录 feishu-plugin/${NC}"
    echo "请确保在仓库根目录运行此脚本"
    exit 1
fi

# 目标目录
TARGET_DIR="$HOME/.clawdbot/extensions/feishu"
BACKUP_DIR="$HOME/.clawdbot/extensions/feishu.backup.$(date +%Y%m%d_%H%M%S)"

# 如果目标目录已存在，备份
if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}⚠ 发现现有插件目录${NC}"
    echo ""
    read -p "是否备份现有插件？(Y/n): " backup_choice
    backup_choice=${backup_choice:-Y}
    
    if [[ "$backup_choice" =~ ^[Yy]$ ]]; then
        cp -r "$TARGET_DIR" "$BACKUP_DIR"
        echo -e "${GREEN}✓ 已备份到: $BACKUP_DIR${NC}"
    fi
    echo ""
    
    read -p "是否覆盖现有插件？(y/N): " overwrite_choice
    overwrite_choice=${overwrite_choice:-N}
    
    if [[ ! "$overwrite_choice" =~ ^[Yy]$ ]]; then
        echo "安装已取消"
        exit 0
    fi
    
    rm -rf "$TARGET_DIR"
fi

# 创建目标目录
mkdir -p "$TARGET_DIR"

echo "复制插件文件到 $TARGET_DIR ..."
cp -r "$SCRIPT_DIR/feishu-plugin/"* "$TARGET_DIR/"

echo -e "${GREEN}✓ 插件文件已复制${NC}"
echo ""

# 安装依赖
echo "安装插件依赖..."
cd "$TARGET_DIR"

if command -v npm &> /dev/null; then
    npm install
    echo -e "${GREEN}✓ 依赖安装成功${NC}"
else
    echo -e "${RED}✗ 未找到 npm，请先安装 Node.js${NC}"
    exit 1
fi

echo ""
echo "================================================"
echo "✅ 插件安装完成！"
echo "================================================"
echo ""

# 检查配置文件
CONFIG_FILE="$HOME/.clawdbot/clawdbot.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠ 未找到配置文件${NC}"
    echo ""
    echo "请运行配置向导："
    echo -e "   ${GREEN}./configure.sh${NC}"
    echo ""
else
    # 检查是否已启用插件
    if grep -q '"feishu"' "$CONFIG_FILE"; then
        echo -e "${GREEN}✓ 配置文件中已包含飞书配置${NC}"
    else
        echo -e "${YELLOW}⚠ 配置文件中未找到飞书配置${NC}"
        echo ""
        echo "请手动添加或运行配置向导："
        echo -e "   ${GREEN}./configure.sh${NC}"
    fi
    echo ""
fi

echo -e "${BLUE}下一步：${NC}"
echo ""
echo "1. 配置飞书信息（如果还未配置）："
echo -e "   ${GREEN}./configure.sh${NC}"
echo ""
echo "2. 重启 Gateway："
echo -e "   ${GREEN}clawdbot gateway stop${NC}"
echo -e "   ${GREEN}clawdbot gateway --verbose${NC}"
echo ""
