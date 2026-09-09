import { Router } from "express";
import type { AppConfig } from "../../config/env.js";
import type { HealthService } from "./health.service.js";

export function createHealthRouter(config: AppConfig, healthService: HealthService) {
  const router = Router();

  router.get("/", (_req, res) => {
    res.status(200).json({ status: "ok", service: "logger-api", environment: config.NODE_ENV });
  });

  const readiness = async (_req: unknown, res: { status(code: number): typeof res; json(body: unknown): void }) => {
    try {
      await healthService.databaseIsReady();
      res.status(200).json({ status: "ok", database: "connected" , message: "Hello World! This is the logger API. It is running and ready to accept requests."});
    } catch {
      res.status(503).json({ status: "error", database: "disconnected" });
    }
  };
  router.get("/ready", readiness);
  router.get("/db", readiness);
  return router;
}