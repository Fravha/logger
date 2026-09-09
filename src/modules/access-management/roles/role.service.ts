import type { AuditService } from "../../../core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../../../core/audit/audit.types.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { PermissionModel } from "../permissions/permission.model.js";
import type { PermissionRepository } from "../permissions/permission.repository.js";
import type { CreateRoleDto, UpdateRoleDto } from "./role.dto.js";
import type { RoleRepository } from "./role.repository.js";

export class RoleService {
  constructor(
    private readonly repository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.repository.findAll();
  }

  async getById(id: string) {
    const role = await this.repository.findById(id);
    if (!role) throw new AppError("ROLE_NOT_FOUND", "Role not found", 404);
    return role;
  }

  async create(data: CreateRoleDto, context: AuthenticatedAuditContext) {
    if (await this.repository.findByCode(data.code)) {
      throw new AppError(
        "ROLE_CODE_ALREADY_EXISTS",
        "A role with this code already exists or was previously archived",
        409,
      );
    }

    const role = await this.repository.create(data);

    await this.audit.record(context, {
      action: "ROLE_CREATED",
      resourceType: "role",
      resourceId: role.id,
      metadata: { code: role.code, name: role.name },
    });

    return role;
  }

  async update(
    id: string,
    data: UpdateRoleDto,
    context: AuthenticatedAuditContext,
  ) {
    const current = await this.getById(id);
    const updated = await this.repository.update(id, data);

    await this.audit.record(context, {
      action: "ROLE_UPDATED",
      resourceType: "role",
      resourceId: updated.id,
      metadata: {
        code: current.code,
        changedFields: Object.keys(data).sort(),
      },
    });

    return updated;
  }

  async delete(id: string, context: AuthenticatedAuditContext) {
    const role = await this.getById(id);

    if (role.code === "admin") {
      throw new AppError(
        "SYSTEM_ROLE_PROTECTED",
        "The admin role cannot be deleted",
        409,
      );
    }

    const users = await this.repository.countUsers(id);
    if (users > 0) {
      throw new AppError(
        "ROLE_IN_USE",
        "Role cannot be deleted while assigned to users",
        409,
      );
    }

    await this.repository.delete(id);

    await this.audit.record(context, {
      action: "ROLE_SOFT_DELETED",
      resourceType: "role",
      resourceId: role.id,
      metadata: { code: role.code, name: role.name },
    });
  }

  async setPermissions(
    id: string,
    permissionIds: string[],
    context: AuthenticatedAuditContext,
  ) {
    const role = await this.getById(id);
    const uniqueIds = [...new Set(permissionIds)];
    const permissions: PermissionModel[] = [];

    for (const permissionId of uniqueIds) {
      const permission = await this.permissionRepository.findById(permissionId);
      if (!permission) {
        throw new AppError(
          "PERMISSION_NOT_FOUND",
          `Permission ${permissionId} not found`,
          404,
        );
      }
      permissions.push(permission);
    }

    const newPermissionCodes = permissions.map((permission) => permission.code).sort();

    if (role.code === "admin") {
      const required = ["users:read", "users:manage", "rbac:read", "rbac:manage"];
      const codes = new Set(newPermissionCodes);
      if (required.some((code) => !codes.has(code))) {
        throw new AppError(
          "SYSTEM_ROLE_PERMISSIONS_PROTECTED",
          "The admin role must retain administration permissions",
          409,
        );
      }
    }

    const previousPermissions = role.permissions.map((permission) => permission.code).sort();
    await this.repository.setPermissions(id, uniqueIds);

    await this.audit.record(context, {
      action: "ROLE_PERMISSIONS_REPLACED",
      resourceType: "role",
      resourceId: role.id,
      metadata: {
        code: role.code,
        previousPermissions,
        newPermissions: newPermissionCodes,
      },
    });
  }
}
