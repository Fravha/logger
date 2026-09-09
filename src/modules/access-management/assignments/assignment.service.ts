import type { AuditService } from "../../../core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../../../core/audit/audit.types.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { AssignmentRepository } from "./assignment.repository.js";

export class AssignmentService {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly audit: AuditService,
  ) {}

  async replaceUserRole(
    userId: string,
    roleId: string,
    context: AuthenticatedAuditContext,
  ) {
    if (!await this.repository.userExists(userId)) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    if (!await this.repository.roleExists(roleId)) {
      throw new AppError("ROLE_NOT_FOUND", "Role not found", 404);
    }

    const previousRoleCode = await this.repository.userRoleCode(userId);
    const newRoleCode = await this.repository.roleCode(roleId);

    if (
      userId === context.actorUserId &&
      previousRoleCode === "admin" &&
      newRoleCode !== "admin"
    ) {
      throw new AppError(
        "USER_CANNOT_REMOVE_OWN_ADMIN",
        "You cannot remove your own admin role",
        409,
      );
    }

    if (
      previousRoleCode === "admin" &&
      newRoleCode !== "admin" &&
      await this.repository.countActiveUsersWithRole("admin") <= 1
    ) {
      throw new AppError(
        "LAST_ADMIN_PROTECTED",
        "The last active administrator cannot lose the admin role",
        409,
      );
    }

    await this.repository.replaceUserRole(userId, roleId);

    await this.audit.record(context, {
      action: "USER_ROLE_REPLACED",
      resourceType: "user",
      resourceId: userId,
      metadata: {
        previousRole: previousRoleCode,
        newRole: newRoleCode,
      },
    });
  }
}
