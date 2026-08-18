import type { CreateRoleDto, UpdateRoleDto } from "./role.dto.js";
import type { RoleModel } from "./role.model.js";

export interface RoleRepository {
  findAll(): Promise<RoleModel[]>;
  findById(id: string): Promise<RoleModel | null>;
  findByCode(code: string): Promise<RoleModel | null>;
  create(data: CreateRoleDto): Promise<RoleModel>;
  update(id: string, data: UpdateRoleDto): Promise<RoleModel>;
  delete(id: string): Promise<void>;
  countUsers(id: string): Promise<number>;
}
