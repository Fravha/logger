import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { AppConfig } from "./config/env.js";
import { env } from "./config/env.js";
import { prisma } from "./infrastructure/database/prisma-client.js";
import { FirebaseIdentityAdmin } from "./infrastructure/identity/firebase-identity-admin.js";
import { FirebasePasswordResetSender } from "./infrastructure/identity/firebase-password-reset-sender.js";
import { FirebaseTokenVerifier } from "./infrastructure/identity/firebase-token-verifier.js";
import { HealthService } from "./modules/health/health.service.js";
import { PrismaUserRepository } from "./core/users/prisma-user.repository.js";
import { createRoutes } from "./routes/index.js";
import { errorHandler } from "./shared/http/error-handler.js";
import { notFoundHandler } from "./shared/http/not-found-handler.js";
import { requestContext } from "./shared/http/request-context.js";

export function createApp(config: AppConfig = env) {
  const app = express();
  const userRepository = new PrismaUserRepository(prisma);
  const tokenVerifier = new FirebaseTokenVerifier(config);
  const identityAdmin = new FirebaseIdentityAdmin(config);
  const passwordResetSender = new FirebasePasswordResetSender(config);
  const healthService = new HealthService(prisma);

  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY);
  app.use(requestContext);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }));
  app.use(rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }));
  app.use(express.json({ limit: "100kb" }));
  app.use(createRoutes({ config, prisma, tokenVerifier, userRepository, identityAdmin, passwordResetSender, healthService }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
