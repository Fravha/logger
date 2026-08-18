import { AppError } from "../../../shared/errors/app-error.js";
import type { PermissionRepository } from "./permission.repository.js";
export class PermissionService {
  constructor(private readonly repository: PermissionRepository) {}
  list() { return this.repository.findAll(); }
  async getById(id: string) {
    const permission = await this.repository.findById(id);
    if (!permission) throw new AppError("PERMISSION_NOT_FOUND", "Permission not found", 404);
    return permission;
  }
}
