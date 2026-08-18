import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../../shared/http/audit-context.js";
import type { AssignmentService } from "./assignment.service.js";

type Params = { id: string };

export class AssignmentController {
  constructor(private readonly service: AssignmentService) {}

  replaceUserRoles = async (
    req: Request<Params>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      await this.service.replaceUserRoles(req.params.id, req.body.roleIds, context);
      res.status(204).send();
    } catch (error) { next(error); }
  };

  replaceRolePermissions = async (
    req: Request<Params>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      await this.service.replaceRolePermissions(
        req.params.id,
        req.body.permissionIds,
        context,
      );
      res.status(204).send();
    } catch (error) { next(error); }
  };
}
