import type { NextFunction, Request, Response } from "express";
import type {
  CreatePermissionInput,
  UpdatePermissionInput,
} from "./permission.repository.js";
import type { PermissionService } from "./permission.service.js";

type Params = { id: string };

export class PermissionController {
  constructor(private readonly service: PermissionService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: await this.service.list() });
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: await this.service.getById(req.params.id) });
    } catch (e) {
      next(e);
    }
  };

  create = async (
    req: Request<Record<string, never>, unknown, CreatePermissionInput>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const permission = await this.service.create(req.body);
      res.status(201).json({ data: permission });
    } catch (e) {
      next(e);
    }
  };

  update = async (
    req: Request<Params, unknown, UpdatePermissionInput>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const permission = await this.service.update(req.params.id, req.body);
      res.status(200).json({ data: permission });
    } catch (e) {
      next(e);
    }
  };

  delete = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };
}