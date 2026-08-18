import type { NextFunction, Request, Response } from "express";

import { buildAuthenticatedAuditContext } from "../../shared/http/audit-context.js";
import type { ProductService } from "./product.service.js";

type ParamsWithId = { id: string };

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await this.productService.list();
      res.status(200).json({ data: products });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request<ParamsWithId>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const product = await this.productService.getById(req.params.id);
      res.status(200).json({ data: product });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      const product = await this.productService.create(req.body, context);
      res.status(201).json({ data: product });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request<ParamsWithId>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      const product = await this.productService.update(
        req.params.id,
        req.body,
        context,
      );
      res.status(200).json({ data: product });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request<ParamsWithId>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const context = buildAuthenticatedAuditContext(req, res);
      await this.productService.delete(req.params.id, context);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
