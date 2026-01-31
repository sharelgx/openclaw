/**
 * 企业微信回调服务器
 * 用于接收企业微信的消息推送
 */
import http from "http";
import crypto from "crypto";
import { URL } from "url";
import { parseStringPromise } from "xml2js";

// 配置信息
const CONFIG = {
  corpId: "wwd942eecef040d78e",
  token: "pKr0mMp9Z6Op",
  encodingAESKey: "3hPX7dwAYg26ClhFiaGHeIzgXUr8HFh941Yul8yRsIO",
  port: 3003,
};

// AES 密钥
const aesKey = Buffer.from(CONFIG.encodingAESKey + "=", "base64");

/**
 * 验证签名
 */
function verifySignature(signature, timestamp, nonce, echostr = "") {
  const items = [CONFIG.token, timestamp, nonce, echostr].filter(Boolean).sort();
  const str = items.join("");
  const hash = crypto.createHash("sha1").update(str).digest("hex");
  return hash === signature;
}

/**
 * 解密消息
 */
function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, aesKey.subarray(0, 16));
  decipher.setAutoPadding(false);
  
  let decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]);

  // 去除 PKCS7 填充
  const padLength = decrypted[decrypted.length - 1];
  decrypted = decrypted.subarray(0, decrypted.length - padLength);

  // 消息格式: random(16) + msgLen(4) + msg + corpId
  const msgLen = decrypted.readUInt32BE(16);
  const message = decrypted.subarray(20, 20 + msgLen).toString("utf8");
  
  return message;
}

/**
 * 创建服务器
 */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${CONFIG.port}`);
    const path = url.pathname;

    console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);

    // 健康检查
    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }

    // 企业微信回调
    if (path === "/callback" || path === "/") {
      const msgSignature = url.searchParams.get("msg_signature") || "";
      const timestamp = url.searchParams.get("timestamp") || "";
      const nonce = url.searchParams.get("nonce") || "";

      // GET 请求: 验证 URL
      if (req.method === "GET") {
        const echostr = url.searchParams.get("echostr") || "";
        
        console.log(`[验证] signature=${msgSignature}, timestamp=${timestamp}, nonce=${nonce}`);
        
        if (!verifySignature(msgSignature, timestamp, nonce, echostr)) {
          console.log("[验证] 签名验证失败");
          res.writeHead(403);
          res.end("Invalid signature");
          return;
        }

        const decrypted = decrypt(echostr);
        console.log(`[验证] 成功! 返回: ${decrypted}`);
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(decrypted);
        return;
      }

      // POST 请求: 接收消息
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }

        console.log(`[消息] 收到 POST 请求`);

        // 解析 XML
        const xml = await parseStringPromise(body, { explicitArray: false });
        const encrypt = xml?.xml?.Encrypt;

        if (!encrypt) {
          console.log("[消息] 缺少 Encrypt 字段");
          res.writeHead(400);
          res.end("Missing Encrypt");
          return;
        }

        // 验证签名
        if (!verifySignature(msgSignature, timestamp, nonce, encrypt)) {
          console.log("[消息] 签名验证失败");
          res.writeHead(403);
          res.end("Invalid signature");
          return;
        }

        // 解密消息
        const decrypted = decrypt(encrypt);
        const msgXml = await parseStringPromise(decrypted, { explicitArray: false });
        const msg = msgXml?.xml;

        console.log(`[消息] 类型=${msg?.MsgType}, 发送者=${msg?.FromUserName}, 内容=${msg?.Content || "(无)"}`);

        // TODO: 在这里处理消息，调用 AI 回复
        // 目前先返回空响应

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("");
        return;
      }
    }

    // 404
    res.writeHead(404);
    res.end("Not Found");
  } catch (err) {
    console.error(`[错误] ${err.message}`);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

// 启动服务器
server.listen(CONFIG.port, () => {
  console.log(`========================================`);
  console.log(`企业微信回调服务器已启动`);
  console.log(`端口: ${CONFIG.port}`);
  console.log(`企业ID: ${CONFIG.corpId}`);
  console.log(`========================================`);
});
