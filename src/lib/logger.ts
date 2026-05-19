import { randomBytes } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";

export function newRequestId() {
  return randomBytes(6).toString("hex");
}

function emit(level: Level, msg: string, data?: Record<string, unknown>) {
  const line = { level, msg, ts: new Date().toISOString(), ...data };
  const text = JSON.stringify(line);
  if (level === "error" || level === "warn") {
    console.error(text);
  } else {
    console.log(text);
  }
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  emit("error", "captured", {
    err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    ...context,
  });
  if (process.env.SENTRY_DSN) {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(err, context ? { extra: context } : undefined);
    }).catch(() => {
      /* ignore */
    });
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => emit("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
  reportError,
};
