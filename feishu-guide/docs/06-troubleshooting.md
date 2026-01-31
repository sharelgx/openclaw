# 06. 故障排查

本文档列出常见问题及解决方法。

## 诊断工具

### 1. Clawdbot Doctor

运行诊断命令：

```bash
clawdbot doctor
```

会检查：
- Node.js 版本
- 配置文件完整性
- 插件状态
- 网络连接

### 2. 查看日志

```bash
# 实时日志
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log

# 只看飞书相关
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep feishu

# 只看错误
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep -i error
```

### 3. 检查配置

```bash
# 验证 JSON 格式
cat ~/.clawdbot/clawdbot.json | python -m json.tool

# 查看飞书配置
cat ~/.clawdbot/clawdbot.json | grep -A 10 feishu
```

## 安装问题

### Clawdbot 安装失败

**症状：**
```
curl: (7) Failed to connect to clawd.bot
```

**解决方法：**
1. 检查网络连接
2. 使用代理：
   ```bash
   export https_proxy=http://127.0.0.1:7890
   curl -fsSL https://clawd.bot/install.sh | bash
   ```
3. 或手动安装：
   ```bash
   npm install -g clawdbot
   ```

### npm 权限错误

**症状：**
```
EACCES: permission denied
```

**解决方法：**
```bash
# 方法 1：配置 npm 全局目录
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 方法 2：使用 npx
npx clawdbot --version
```

## 配置问题

### 配置文件格式错误

**症状：**
```
Invalid config at ~/.clawdbot/clawdbot.json
```

**解决方法：**
1. 验证 JSON 格式：
   ```bash
   cat ~/.clawdbot/clawdbot.json | python -m json.tool
   ```
2. 或使用在线工具：https://jsonlint.com/
3. 参考示例配置：[config-examples/](../config-examples/)

### App ID/Secret 错误

**症状：**
```
[feishu] 长连接启动失败: 10013
```

**解决方法：**
1. 验证 App ID 格式：`cli_` 开头
2. 重新获取 App Secret（只显示一次）
3. 检查配置文件中的引号和逗号

### API Key 无效

**症状：**
```
authentication_error: Invalid API key
```

**解决方法：**
1. 检查 API Key 是否正确复制（注意首尾空格）
2. 验证 API Key 是否过期
3. 确认 `baseUrl` 和 `apiKey` 匹配

## 插件问题

### 插件未加载

**症状：**
```
[gateway] 飞书插件已加载（长连接模式，无需 webhook 地址）
```
未出现在日志中

**解决方法：**
1. 检查插件目录：
   ```bash
   ls ~/.clawdbot/extensions/feishu/
   ```
2. 检查配置：
   ```bash
   cat ~/.clawdbot/clawdbot.json | grep -A 5 '"plugins"'
   ```
3. 重新安装插件：
   ```bash
   ./install-plugin.sh
   ```

### 依赖安装失败

**症状：**
```
Error: Cannot find module '@larksuiteoapi/node-sdk'
```

**解决方法：**
```bash
cd ~/.clawdbot/extensions/feishu
npm install
```

### TypeScript 编译错误

**症状：**
```
SyntaxError: Unexpected token 'export'
```

**解决方法：**
1. 确认 Node.js 版本 >= 18
2. 检查 `package.json` 中的 `"type": "module"`
3. 清理并重新安装：
   ```bash
   cd ~/.clawdbot/extensions/feishu
   rm -rf node_modules package-lock.json
   npm install
   ```

## Gateway 问题

### Gateway 启动失败

**症状：**
```
Gateway failed to start: gateway already running (pid XXX)
```

**解决方法：**
```bash
# 停止现有 Gateway
clawdbot gateway stop

# 如果停止失败，手动 kill
kill <pid>

# 重新启动
clawdbot gateway --verbose
```

### 端口被占用

**症状：**
```
Port 18789 is already in use
```

**解决方法：**
1. 修改端口：编辑配置文件
   ```json
   {
     "gateway": {
       "port": 18790
     }
   }
   ```
2. 或找出占用进程：
   ```bash
   lsof -i :18789
   kill <pid>
   ```

### Gateway 自动退出

**症状：**
Gateway 启动后几秒钟就退出

**解决方法：**
1. 查看完整日志：
   ```bash
   clawdbot gateway --verbose
   ```
2. 检查配置文件错误
3. 确认所有依赖已安装

## 飞书连接问题

### 长连接保存失败

**症状：**
飞书后台提示「应用未建立长连接」

**解决方法：**
1. **先启动 Gateway**：
   ```bash
   clawdbot gateway --verbose
   ```
2. 等待看到：
   ```
   [feishu] 长连接已连接
   ```
3. 然后在飞书后台保存

**顺序很重要：先本地启动，再后台保存！**

### 收不到消息

**症状：**
在飞书中发送消息，Gateway 无反应

**排查步骤：**

1. **检查长连接状态**
   ```bash
   tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log | grep feishu
   ```
   应该看到 `[feishu] 长连接已连接`

2. **检查事件订阅**
   - 飞书后台 → 事件与回调 → 事件配置
   - 确认已订阅 `im.message.receive_v1`

3. **检查权限**
   - 飞书后台 → 权限管理
   - 确认「获取与发送单聊、群组消息」已批准
   - 如需接收单聊事件，确认 `im:message.p2p_msg` 已批准

4. **检查应用状态**
   - 确认应用已发布
   - 确认应用在企业中可见

5. **检查配对状态**
   - 如果使用 `pairing`，确认已批准配对

### 收到消息但无回复

**症状：**
日志显示收到消息，但机器人不回复

**排查步骤：**

1. **检查配对**（如果使用 pairing）
   ```bash
   clawdbot pairing list
   clawdbot pairing approve feishu <code>
   ```

2. **检查模型配置**
   查看日志中的错误信息

3. **检查 API Key**
   ```bash
   # 测试 API 连接
   curl -X POST "YOUR_BASE_URL/v1/messages" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{"model":"claude-sonnet-4","messages":[{"role":"user","content":"hi"}],"max_tokens":100}'
   ```

4. **检查网络**
   确保能访问 API 服务

### 消息延迟很高

**症状：**
发送消息后等待很久才收到回复

**解决方法：**

1. **使用更快的模型**
   - Haiku > Sonnet > Opus

2. **降低防抖时间**
   ```json
   {
     "messages": {
       "inbound": {
         "byChannel": {
           "feishu": 0
         }
       }
     }
   }
   ```

3. **使用中转站**
   - 可能比官方 API 更快

4. **检查网络**
   - 使用 `ping` 和 `traceroute` 诊断

## 性能问题

### 内存占用过高

**解决方法：**
1. 限制上下文窗口
2. 定期重启 Gateway
3. 减少加载的插件

### CPU 占用过高

**解决方法：**
1. 检查是否有死循环
2. 查看日志中的异常
3. 使用更快的模型

## 获取帮助

### 社区支持

- **Discord**：[Moltbot Discord](https://discord.gg/clawdbot)
- **GitHub**：[moltbot/moltbot](https://github.com/moltbot/moltbot)
- **文档**：[clawd.bot](https://clawd.bot)

### 提交 Issue

在 GitHub 提交 Issue 时，请包含：

1. **环境信息**
   ```bash
   clawdbot --version
   node --version
   uname -a
   ```

2. **配置文件**（隐去敏感信息）
   ```bash
   cat ~/.clawdbot/clawdbot.json
   ```

3. **日志**
   ```bash
   tail -n 100 /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log
   ```

4. **重现步骤**
   详细描述如何重现问题

### 日志收集

收集完整日志用于调试：

```bash
# 创建调试信息包
mkdir ~/clawdbot-debug
cp ~/.clawdbot/clawdbot.json ~/clawdbot-debug/ 
cp /tmp/clawdbot/*.log ~/clawdbot-debug/
tar -czf ~/clawdbot-debug.tar.gz ~/clawdbot-debug/

# 记得隐去敏感信息！
```

## 常用命令速查

```bash
# 诊断
clawdbot doctor

# 查看状态
clawdbot gateway status

# 启动/停止
clawdbot gateway --verbose
clawdbot gateway stop

# 查看日志
tail -f /tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log

# 配对管理
clawdbot pairing list
clawdbot pairing approve feishu <code>

# 更新
clawdbot update
```

## 下一步

- [返回主文档](../README.md)
- [查看配置示例](../config-examples/)
- 访问社区获取帮助
