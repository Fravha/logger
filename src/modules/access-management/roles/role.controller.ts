import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../../shared/http/audit-context.js";
import type { RoleService } from "./role.service.js";

type Params = { id: string };

export class RoleController {
  constructor(private readonly service: RoleService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json({ data: await this.service.list() }); } catch (error) { next(error); }
  };

  getById = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try { res.status(200).json({ data: await this.service.getById(req.params.id) }); } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      res.status(201).json({ data: await this.service.create(req.body, context) });
    } catch (error) { next(error); }
  };

  update = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      res.status(200).json({ data: await this.service.update(req.params.id, req.body, context) });
    } catch (error) { next(error); }
  };

  delete = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      await this.service.delete(req.params.id, context);
      res.status(204).send();
    } catch (error) { next(error); }
  };

  setPermissions = async (
    req: Request<Params>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const context = buildAuthenticatedAuditContext(
        req,
        res,
      );

      await this.service.setPermissions(
        req.params.id,
        req.body.permissionIds,
        context,
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

}
