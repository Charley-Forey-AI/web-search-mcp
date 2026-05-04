import { redactSecrets } from "./errors.js";

type Level = "debug" | "info" | "warn" | "error";

export type LogPayload = {
  msg: string;
  tool?: string;
  provider?: string;
  latency_ms?: number;
  status?: string | number;
  [key: string]: unknown;
};

export class Logger {
  constructor(private readonly debugEnabled: boolean) {}

  log(level: Level, payload: LogPayload): void {
    if (level === "debug" && !this.debugEnabled) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ...payload,
      msg: redactSecrets(payload.msg),
    });
    process.stderr.write(`${line}\n`);
  }

  debug(payload: LogPayload): void {
    this.log("debug", payload);
  }
  info(payload: LogPayload): void {
    this.log("info", payload);
  }
  warn(payload: LogPayload): void {
    this.log("warn", payload);
  }
  error(payload: LogPayload): void {
    this.log("error", payload);
  }
}
