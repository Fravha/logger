import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./infrastructure/database/prisma-client.js";
import { logger } from "./infrastructure/logging/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Logger API started");
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "graceful shutdown started");

  const forceShutdown = setTimeout(() => {
    logger.fatal("graceful shutdown timed out");
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceShutdown.unref();

  server.close(async (error) => {
    if (error) logger.error({ error }, "HTTP server failed to close cleanly");
    await prisma.$disconnect();
    clearTimeout(forceShutdown);
    process.exit(error ? 1 : 0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  logger.fatal({ error }, "unhandled rejection");
  void shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "uncaught exception");
  void shutdown("SIGTERM");
});
