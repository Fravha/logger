import type { AuditService } from "../../../core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../../../core/audit/audit.types.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { AssignmentRepository } from "./assignment.repository.js";

export class AssignmentService {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly audit: AuditService,
  ) {}

  async replaceUserRoles(
    userId: string,
    roleIds: string[],
    context: AuthenticatedAuditContext,
  ) {
    if (!await this.repository.userExists(userId)) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    const unique = [...new Set(roleIds)];
    if (await this.repository.countRoles(unique) !== unique.length) {
      throw new AppError("ROLE_NOT_FOUND", "One or more roles do not exist", 404);
    }

    const newRoleCodes = (await this.repository.roleCodes(unique)).sort();

    if (
      userId === context.actorUserId &&
      await this.repository.userHasRole(userId, "admin") &&
      !newRoleCodes.includes("admin")
    ) {
      throw new AppError(
        "USER_CANNOT_REMOVE_OWN_ADMIN",
        "You cannot remove your own admin role",
        409,
      );
    }

    if (await this.repository.userHasRole(userId, "admin")) {
      if (
        !newRoleCodes.includes("admin") &&
        await this.repository.countActiveUsersWithRole("admin") <= 1
      ) {
        throw new AppError(
          "LAST_ADMIN_PROTECTED",
          "The last active administrator cannot lose the admin role",
          409,
        );
      }
    }

    const previousRoleCodes = (await this.repository.userRoleCodes(userId)).sort();
    await this.repository.replaceUserRoles(userId, unique);

    await this.audit.record(context, {
      action: "USER_ROLES_REPLACED",
      resourceType: "user",
      resourceId: userId,
      metadata: {
        previousRoles: previousRoleCodes,
        newRoles: newRoleCodes,
      },
    });
  }

  async replaceRolePermissions(
    roleId: string,
    permissionIds: string[],
    context: AuthenticatedAuditContext,
  ) {
    if (!await this.repository.roleExists(roleId)) {
      throw new AppError("ROLE_NOT_FOUND", "Role not found", 404);
    }

    const unique = [...new Set(permissionIds)];
    if (await this.repository.countPermissions(unique) !== unique.length) {
      throw new AppError("PERMISSION_NOT_FOUND", "One or more permissions do not exist", 404);
    }

    const roleCode = await this.repository.roleCode(roleId);
    const newPermissionCodes = (await this.repository.permissionCodes(unique)).sort();

    if (roleCode === "admin") {
      const required = ["users:read", "users:manage", "rbac:read", "rbac:manage"];
      const codes = new Set(newPermissionCodes);
      if (required.some((code) => !codes.has(code))) {
        throw new AppError(
          "SYSTEM_ROLE_PERMISSIONS_PROTECTED",
          "The admin role must retain Logger administration permissions",
          409,
        );
      }
    }

    const previousPermissionCodes = (
      await this.repository.rolePermissionCodes(roleId)
    ).sort();

    await this.repository.replaceRolePermissions(roleId, unique);

    await this.audit.record(context, {
      action: "ROLE_PERMISSIONS_REPLACED",
      resourceType: "role",
      resourceId: roleId,
      metadata: {
        roleCode: roleCode ?? "unknown",
        previousPermissions: previousPermissionCodes,
        newPermissions: newPermissionCodes,
      },
    });
  }
}
