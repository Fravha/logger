import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../../shared/http/audit-context.js";
import type { UserAdminService } from "./user-admin.service.js";

type Params = { id: string };

export class UserAdminController {
  constructor(private readonly service: UserAdminService) {}

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

  activate = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      res.status(200).json({ data: await this.service.activate(req.params.id, context) });
    } catch (error) { next(error); }
  };

  suspend = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      res.status(200).json({ data: await this.service.suspend(req.params.id, context) });
    } catch (error) { next(error); }
  };

  resendPasswordSetup = async (req: Request<Params>, res: Response, next: NextFunction) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      await this.service.resendPasswordSetup(req.params.id, context);
      res.status(204).send();
    } catch (error) { next(error); }
  };
}
