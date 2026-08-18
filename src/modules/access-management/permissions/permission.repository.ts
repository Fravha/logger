import type { PermissionModel } from "./permission.model.js";
export interface PermissionRepository {
  findAll(): Promise<PermissionModel[]>;
  findById(id: string): Promise<PermissionModel | null>;
}
