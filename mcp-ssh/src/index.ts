/**
 * MCP SSH Server - 通过 MCP 在远程服务器上执行命令
 * 使用 stderr 输出日志，避免污染 stdout（stdio 传输要求）
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Client, ClientChannel } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const log = (msg: string) => console.error(`[mcp-ssh] ${msg}`);

function execOverSsh(options: {
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  command: string;
  timeoutMs?: number;
}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const conn = new Client();
    const timeoutMs = options.timeoutMs ?? 30000;

    const connectOpts: Record<string, unknown> = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 15000,
    };

    if (options.privateKeyPath) {
      try {
        const keyPath = resolve(options.privateKeyPath);
        connectOpts.privateKey = readFileSync(keyPath, "utf8");
      } catch (e) {
        rejectPromise(new Error(`无法读取私钥文件: ${options.privateKeyPath}, ${e}`));
        return;
      }
    }
    if (options.password) {
      connectOpts.password = options.password;
    }

    let resolved = false;
    const done = (err: Error | null, result?: { stdout: string; stderr: string; code: number | null }) => {
      if (resolved) return;
      resolved = true;
      try {
        conn.end();
      } catch (_) {}
      if (err) rejectPromise(err);
      else resolvePromise(result!);
    };

    const t = setTimeout(() => {
      if (!resolved) {
        conn.end();
        done(new Error(`命令执行超时 (${timeoutMs}ms)`), {
          stdout: "",
          stderr: `Timeout after ${timeoutMs}ms`,
          code: null,
        });
      }
    }, timeoutMs);

    conn
      .on("ready", () => {
        conn.exec(options.command, (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            clearTimeout(t);
            done(err);
            return;
          }
          let stdout = "";
          let stderr = "";
          stream.on("data", (data: Buffer) => {
            stdout += data.toString("utf8");
          });
          stream.stderr.on("data", (data: Buffer) => {
            stderr += data.toString("utf8");
          });
          stream.on("close", (code: number) => {
            clearTimeout(t);
            done(null, { stdout, stderr, code: code ?? null });
          });
        });
      })
      .on("error", (err: Error) => {
        clearTimeout(t);
        done(err);
      })
      .connect(connectOpts);
  });
}

/** 通过 SFTP 上传本地文件到服务器 */
function uploadFileOverSsh(options: {
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  localPath: string;
  remotePath: string;
  timeoutMs?: number;
}): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const conn = new Client();
    const timeoutMs = options.timeoutMs ?? 120000;
    const connectOpts: Record<string, unknown> = {
      host: options.host,
      port: options.port,
      username: options.username,
      readyTimeout: 15000,
    };
    if (options.privateKeyPath) {
      try {
        connectOpts.privateKey = readFileSync(resolve(options.privateKeyPath), "utf8");
      } catch (e) {
        rejectPromise(new Error(`无法读取私钥: ${options.privateKeyPath}, ${e}`));
        return;
      }
    }
    if (options.password) connectOpts.password = options.password;

    let resolved = false;
    const done = (err: Error | null) => {
      if (resolved) return;
      resolved = true;
      try { conn.end(); } catch (_) {}
      if (err) rejectPromise(err);
      else resolvePromise();
    };
    const t = setTimeout(() => {
      if (!resolved) done(new Error(`上传超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    conn
      .on("ready", () => {
        conn.sftp((err: Error | undefined, sftp) => {
          if (err) { clearTimeout(t); done(err); return; }
          const local = resolve(options.localPath);
          sftp.fastPut(local, options.remotePath, (e) => {
            clearTimeout(t);
            done(e || null);
          });
        });
      })
      .on("error", (err: Error) => { clearTimeout(t); done(err); })
      .connect(connectOpts);
  });
}

const server = new McpServer({
  name: "mcp-ssh",
  version: "1.0.0",
});

// 工具：在远程服务器上执行一条命令
server.registerTool(
  "ssh_execute",
  {
    description: "在远程服务器上执行一条 Shell 命令。支持私钥或密码认证。每次调用会建立新连接、执行命令后断开。",
    inputSchema: {
      host: z.string().describe("SSH 主机地址，如 111.231.75.63"),
      port: z.number().optional().default(22).describe("SSH 端口，默认 22"),
      username: z.string().describe("登录用户名，如 ubuntu"),
      privateKeyPath: z.string().optional().describe("私钥文件路径（绝对路径或相对于当前工作目录）"),
      password: z.string().optional().describe("登录密码。若提供私钥则可不填"),
      command: z.string().describe("要在远程执行的命令，如 ls -la 或 whoami"),
      timeoutMs: z.number().optional().default(30000).describe("超时毫秒数，默认 30000"),
    },
  },
  async ({ host, port, username, privateKeyPath, password, command, timeoutMs }) => {
    if (!privateKeyPath && !password) {
      return {
        content: [
          {
            type: "text",
            text: "错误：必须提供 privateKeyPath 或 password 之一。",
          },
        ],
      };
    }
    log(`执行: ${username}@${host}:${port ?? 22} -> ${command}`);
    try {
      const result = await execOverSsh({
        host,
        port: port ?? 22,
        username,
        privateKeyPath,
        password,
        command,
        timeoutMs,
      });
      const text = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exit code: ${result.code}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        content: [{ type: "text" as const, text: text || "(无输出)" }],
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log(`错误: ${errMsg}`);
      return {
        content: [{ type: "text" as const, text: `执行失败: ${errMsg}` }],
        isError: true,
      };
    }
  }
);

// 工具：列出远程目录（便于 AI 了解服务器文件结构）
server.registerTool(
  "ssh_ls",
  {
    description: "列出远程服务器上某目录下的文件和子目录（相当于执行 ls -la）。",
    inputSchema: {
      host: z.string().describe("SSH 主机地址"),
      port: z.number().optional().default(22),
      username: z.string().describe("登录用户名"),
      privateKeyPath: z.string().optional(),
      password: z.string().optional(),
      path: z.string().optional().default(".").describe("要列出的远程路径，默认当前用户主目录"),
      timeoutMs: z.number().optional().default(10000),
    },
  },
  async (args) => {
    const pathArg = args.path === "." ? "" : `"${String(args.path).replace(/"/g, '\\"')}"`;
    const command = `ls -la ${pathArg}`.trim();
    if (!args.privateKeyPath && !args.password) {
      return {
        content: [{ type: "text" as const, text: "错误：必须提供 privateKeyPath 或 password 之一。" }],
      };
    }
    try {
      const result = await execOverSsh({
        host: args.host,
        port: args.port ?? 22,
        username: args.username,
        privateKeyPath: args.privateKeyPath,
        password: args.password,
        command,
        timeoutMs: args.timeoutMs ?? 10000,
      });
      const text = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exit code: ${result.code}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return { content: [{ type: "text" as const, text: text || "(无输出)" }] };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text" as const, text: `执行失败: ${errMsg}` }], isError: true };
    }
  }
);

// 工具：本地上传文件到服务器（SFTP）
server.registerTool(
  "ssh_upload_file",
  {
    description: "将本地文件通过 SFTP 上传到远程服务器。用于上传打包后的项目等。",
    inputSchema: {
      host: z.string().describe("SSH 主机地址"),
      port: z.number().optional().default(22),
      username: z.string().describe("登录用户名"),
      privateKeyPath: z.string().optional(),
      password: z.string().optional(),
      localPath: z.string().describe("本地文件绝对路径，如 E:\\AIcode\\moltbot\\moltbot-repo.tar.gz"),
      remotePath: z.string().describe("远程路径，如 /home/ubuntu/moltbot-repo.tar.gz"),
      timeoutMs: z.number().optional().default(300000).describe("超时毫秒，大文件可设大一些"),
    },
  },
  async (args) => {
    if (!args.privateKeyPath && !args.password) {
      return { content: [{ type: "text" as const, text: "错误：必须提供 privateKeyPath 或 password 之一。" }] };
    }
    const local = resolve(args.localPath);
    if (!existsSync(local)) {
      return { content: [{ type: "text" as const, text: `错误：本地文件不存在: ${local}` }], isError: true };
    }
    log(`上传: ${local} -> ${args.username}@${args.host}:${args.remotePath}`);
    try {
      await uploadFileOverSsh({
        host: args.host,
        port: args.port ?? 22,
        username: args.username,
        privateKeyPath: args.privateKeyPath,
        password: args.password,
        localPath: local,
        remotePath: args.remotePath,
        timeoutMs: args.timeoutMs ?? 300000,
      });
      return { content: [{ type: "text" as const, text: `上传成功: ${args.remotePath}` }] };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log(`上传失败: ${errMsg}`);
      return { content: [{ type: "text" as const, text: `上传失败: ${errMsg}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("mcp-ssh 已就绪，使用 stdio 传输");
}

main().catch((err) => {
  console.error("mcp-ssh 启动失败:", err);
  process.exit(1);
});
