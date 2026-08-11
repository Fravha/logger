import pino from "pino";
import { env } from "../../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "logger-api", environment: env.NODE_ENV },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "authorization", "cookie", "token"],
    censor: "[REDACTED]",
  },
});
