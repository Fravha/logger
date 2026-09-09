import type { NextFunction, Request, Response } from "express";
import { buildAuthenticatedAuditContext } from "../../shared/http/audit-context.js";
import type { PurchaseService } from "./purchase.service.js";

type ParamsWithId = { id: string };

export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}
  list = async (_req: Request, res: Response, next: NextFunction) => { try { res.status(200).json({ data: await this.purchaseService.list() }); } catch (error) { next(error); } };
  getById = async (req: Request<ParamsWithId>, res: Response, next: NextFunction) => { try { res.status(200).json({ data: await this.purchaseService.getById(req.params.id) }); } catch (error) { next(error); } };
  create = async (req: Request, res: Response, next: NextFunction) => { try { res.status(201).json({ data: await this.purchaseService.create(req.body, buildAuthenticatedAuditContext(req, res)) }); } catch (error) { next(error); } };
  update = async (req: Request<ParamsWithId>, res: Response, next: NextFunction) => { try { res.status(200).json({ data: await this.purchaseService.update(req.params.id, req.body, buildAuthenticatedAuditContext(req, res)) }); } catch (error) { next(error); } };
  delete = async (req: Request<ParamsWithId>, res: Response, next: NextFunction) => { try { await this.purchaseService.delete(req.params.id, buildAuthenticatedAuditContext(req, res)); res.status(204).send(); } catch (error) { next(error); } };
}
