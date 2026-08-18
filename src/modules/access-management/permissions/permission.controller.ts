import type { NextFunction, Request, Response } from "express";
import type { PermissionService } from "./permission.service.js";
type Params = { id: string };
export class PermissionController {
  constructor(private readonly service: PermissionService) {}
  list = async (_req: Request, res: Response, next: NextFunction) => { try { res.status(200).json({ data: await this.service.list() }); } catch (e) { next(e); } };
  getById = async (req: Request<Params>, res: Response, next: NextFunction) => { try { res.status(200).json({ data: await this.service.getById(req.params.id) }); } catch (e) { next(e); } };
}
