import type { PermissionModel } from "./permission.model.js";

export interface CreatePermissionInput {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdatePermissionInput {
  code?: string;
  name?: string;
  description?: string | null;
}

export interface PermissionRepository {
  findAll(): Promise<PermissionModel[]>;
  findById(id: string): Promise<PermissionModel | null>;
  findByCode(code: string): Promise<PermissionModel | null>;
  create(data: CreatePermissionInput): Promise<PermissionModel>;
  update(id: string, data: UpdatePermissionInput): Promise<PermissionModel>;
  delete(id: string): Promise<void>;
}
