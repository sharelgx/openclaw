/**
 * 企业微信回调中转服务器
 * 
 * 功能：
 * 1. 接收企业微信的 HTTP 回调
 * 2. 解密消息
 * 3. 通过 WebSocket 推送给本地 OpenClaw
 * 
 * 本地 OpenClaw 负责 AI 处理和回复
 */
import http from "http";
import crypto from "crypto";
import { URL } from "url";
import { parseStringPromise } from "xml2js";
import { WebSocketServer, WebSocket } from "ws";

// ==================== 配置信息 ====================
const CONFIG = {
  corpId: "wwd942eecef040d78e",
  corpSecret: "XYqbQvhgIj5E0Q59ZqRsSu9cmJpoHFEUDlkVr9h-iX4",
  agentId: "1000004",
  token: "pKr0mMp9Z6Op",
  encodingAESKey: "3hPX7dwAYg26ClhFiaGHeIzgXUr8HFh941Yul8yRsIO",
  port: 3003,
  wsPort: 3004, // WebSocket 端口
};

// AES 密钥
const aesKey = Buffer.from(CONFIG.encodingAESKey + "=", "base64");

// Access Token 缓存
let cachedToken = null;

// 已连接的 OpenClaw 客户端
const connectedClients = new Set();

// ==================== 加解密函数 ====================

function verifySignature(signature, timestamp, nonce, echostr = "") {
  const items = [CONFIG.token, timestamp, nonce, echostr].filter(Boolean).sort();
  const str = items.join("");
  const hash = crypto.createHash("sha1").update(str).digest("hex");
  return hash === signature;
}

function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, aesKey.subarray(0, 16));
  decipher.setAutoPadding(false);
  
  let decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]);

  const padLength = decrypted[decrypted.length - 1];
  decrypted = decrypted.subarray(0, decrypted.length - padLength);

  const msgLen = decrypted.readUInt32BE(16);
  const message = decrypted.subarray(20, 20 + msgLen).toString("utf8");
  
  return message;
}

// ==================== Access Token 管理 ====================

async function getAccessToken() {
  // 检查缓存
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  // 获取新 token
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CONFIG.corpId}&corpsecret=${CONFIG.corpSecret}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`获取 access_token 失败: ${data.errcode} - ${data.errmsg}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  console.log("[Token] 获取新的 access_token");
  return cachedToken.token;
}

// ==================== 发送消息到企业微信 ====================

async function sendMessageToWecom(to, content, retried = false) {
  try {
    const accessToken = await getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;

    // 解析接收者
    let toUser = "";
    let toChat = "";

    if (to.startsWith("user:")) {
      toUser = to.slice(5);
    } else if (to.startsWith("chat:")) {
      toChat = to.slice(5);
    } else {
      toUser = to;
    }

    const body = {
      agentid: parseInt(CONFIG.agentId, 10),
      msgtype: "text",
      text: { content },
      safe: 0,
    };

    if (toChat) {
      body.chatid = toChat;
    } else {
      body.touser = toUser;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.errcode && data.errcode !== 0) {
      // Token 过期，清除缓存重试
      if ((data.errcode === 40014 || data.errcode === 42001) && !retried) {
        cachedToken = null;
        return sendMessageToWecom(to, content, true);
      }
      throw new Error(`${data.errcode} - ${data.errmsg}`);
    }

    console.log(`[发送] 成功发送到 ${to}`);
    return { success: true, msgid: data.msgid };
  } catch (err) {
    console.error(`[发送] 失败: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ==================== 推送消息给 OpenClaw ====================

function broadcastToClients(message) {
  const data = JSON.stringify(message);
  let sent = 0;
  
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sent++;
    }
  }
  
  console.log(`[WS] 推送消息给 ${sent}/${connectedClients.size} 个客户端`);
  return sent > 0;
}

// ==================== HTTP 服务器 ====================

const httpServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${CONFIG.port}`);
    const path = url.pathname;

    console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);

    // 健康检查
    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        clients: connectedClients.size,
      }));
      return;
    }

    // 状态页面
    if (path === "/status") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <h1>企业微信回调中转服务</h1>
        <p>HTTP 端口: ${CONFIG.port}</p>
        <p>WebSocket 端口: ${CONFIG.wsPort}</p>
        <p>已连接客户端: ${connectedClients.size}</p>
        <p>企业ID: ${CONFIG.corpId}</p>
      `);
      return;
    }

    // 企业微信回调
    if (path === "/callback" || path === "/") {
      const msgSignature = url.searchParams.get("msg_signature") || "";
      const timestamp = url.searchParams.get("timestamp") || "";
      const nonce = url.searchParams.get("nonce") || "";

      // GET: 验证 URL
      if (req.method === "GET") {
        const echostr = url.searchParams.get("echostr") || "";
        
        if (!verifySignature(msgSignature, timestamp, nonce, echostr)) {
          console.log("[验证] 签名失败");
          res.writeHead(403);
          res.end("Invalid signature");
          return;
        }

        const decrypted = decrypt(echostr);
        console.log("[验证] URL 验证成功");
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(decrypted);
        return;
      }

      // POST: 接收消息
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }

        const xml = await parseStringPromise(body, { explicitArray: false });
        const encrypt = xml?.xml?.Encrypt;

        if (!encrypt) {
          res.writeHead(400);
          res.end("Missing Encrypt");
          return;
        }

        if (!verifySignature(msgSignature, timestamp, nonce, encrypt)) {
          res.writeHead(403);
          res.end("Invalid signature");
          return;
        }

        const decrypted = decrypt(encrypt);
        const msgXml = await parseStringPromise(decrypted, { explicitArray: false });
        const msg = msgXml?.xml;

        console.log(`[消息] 类型=${msg?.MsgType}, 发送者=${msg?.FromUserName}, 内容=${msg?.Content || "(无)"}`);

        // 推送给本地 OpenClaw 处理
        if (msg?.MsgType === "text" && msg?.Content) {
          const pushed = broadcastToClients({
            type: "message",
            data: {
              msgType: msg.MsgType,
              fromUser: msg.FromUserName,
              toUser: msg.ToUserName,
              content: msg.Content,
              msgId: msg.MsgId,
              agentId: msg.AgentID,
              createTime: msg.CreateTime,
            },
          });

          if (!pushed) {
            console.log("[警告] 没有已连接的 OpenClaw 客户端");
          }
        }

        // 立即返回空响应
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("");
        return;
      }
    }

    res.writeHead(404);
    res.end("Not Found");
  } catch (err) {
    console.error(`[错误] ${err.message}`);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

// ==================== WebSocket 服务器 ====================

const wss = new WebSocketServer({ port: CONFIG.wsPort });

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] 新连接: ${clientIp}`);
  connectedClients.add(ws);

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: "connected",
    data: {
      corpId: CONFIG.corpId,
      message: "已连接到企业微信中转服务器",
    },
  }));

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`[WS] 收到消息: ${msg.type}`);
      
      // 处理心跳
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // 处理发送消息请求
      if (msg.type === "send_message") {
        const { to, content, requestId } = msg.data || {};
        
        if (!to || !content) {
          ws.send(JSON.stringify({
            type: "send_result",
            data: { requestId, success: false, error: "缺少 to 或 content" },
          }));
          return;
        }

        const result = await sendMessageToWecom(to, content);
        ws.send(JSON.stringify({
          type: "send_result",
          data: { requestId, ...result },
        }));
        return;
      }
    } catch (err) {
      console.error(`[WS] 解析消息失败: ${err.message}`);
    }
  });

  ws.on("close", () => {
    console.log(`[WS] 连接断开: ${clientIp}`);
    connectedClients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error(`[WS] 错误: ${err.message}`);
    connectedClients.delete(ws);
  });
});

// ==================== 启动服务 ====================

httpServer.listen(CONFIG.port, () => {
  console.log(`========================================`);
  console.log(`企业微信回调中转服务器已启动`);
  console.log(`HTTP 端口: ${CONFIG.port} (接收企业微信回调)`);
  console.log(`WebSocket 端口: ${CONFIG.wsPort} (连接本地 OpenClaw)`);
  console.log(`企业ID: ${CONFIG.corpId}`);
  console.log(`========================================`);
  console.log(`等待 OpenClaw 连接...`);
});
