/**
 * Structured logger. Never log listing contact details, user emails, locations or report text.
 * A crash-reporting sink (e.g. Sentry) can be attached with setLogSink() — see docs/OBSERVABILITY.md.
 */
type Level = "debug" | "info" | "warn" | "error";
export interface LogEvent {
  level: Level;
  msg: string;
  ctx?: Record<string, unknown>;
  at: string;
}
type Sink = (e: LogEvent) => void;

const REDACT_KEYS = /email|phone|contact|lat|lng|location|token|password|details|address/i;

export function redact(ctx: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ctx) return ctx;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) out[k] = REDACT_KEYS.test(k) ? "[redacted]" : v;
  return out;
}

let sink: Sink | null = null;
const recent: LogEvent[] = [];

export function setLogSink(s: Sink | null) {
  sink = s;
}
export function recentLogs(): LogEvent[] {
  return [...recent];
}

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  const e: LogEvent = { level, msg, ctx: redact(ctx), at: new Date().toISOString() };
  recent.push(e);
  if (recent.length > 100) recent.shift();
  if (level !== "debug" || __DEV__) {
    // eslint-disable-next-line no-console
    (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(`[hc] ${msg}`, e.ctx ?? "");
  }
  sink?.(e);
}

export const log = {
  debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),
};
