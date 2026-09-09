import { AppError } from "../../../shared/errors/app-error.js";
import type {
  CreatePermissionInput,
  PermissionRepository,
  UpdatePermissionInput,
} from "./permission.repository.js";

export class PermissionService {
  constructor(private readonly repository: PermissionRepository) {}

  list() {
    return this.repository.findAll();
  }

  async getById(id: string) {
    const permission = await this.repository.findById(id);
    if (!permission) {
      throw new AppError("PERMISSION_NOT_FOUND", "Permission not found", 404);
    }
    return permission;
  }

  async create(data: CreatePermissionInput) {
    const existing = await this.repository.findByCode(data.code);
    if (existing) {
      throw new AppError(
        "PERMISSION_CODE_ALREADY_EXISTS",
        "A permission with this code already exists",
        409,
      );
    }

    return this.repository.create(data);
  }

  async update(id: string, data: UpdatePermissionInput) {
    await this.getById(id);

    if (data.code) {
      const existing = await this.repository.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw new AppError(
          "PERMISSION_CODE_ALREADY_EXISTS",
          "A permission with this code already exists",
          409,
        );
      }
    }

    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.getById(id);
    await this.repository.delete(id);
  }
}