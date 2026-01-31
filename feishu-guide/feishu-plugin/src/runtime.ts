import type { ClawdbotRuntime } from "clawdbot/plugin-sdk";

let runtime: ClawdbotRuntime | null = null;

export function setFeishuRuntime(rt: ClawdbotRuntime) {
  runtime = rt;
}

export function getFeishuRuntime(): ClawdbotRuntime {
  if (!runtime) {
    throw new Error("飞书 runtime 未初始化");
  }
  return runtime;
}
