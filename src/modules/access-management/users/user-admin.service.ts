import { randomUUID } from "node:crypto";
import type { AuditService } from "../../../core/audit/audit.service.js";
import type { AuthenticatedAuditContext } from "../../../core/audit/audit.types.js";
import type { PasswordResetSender } from "../../../core/auth/password-reset-sender.js";
import { AppError } from "../../../shared/errors/app-error.js";
import type { CreateUserAdminDto, UpdateUserAdminDto } from "./user-admin.dto.js";
import type { IdentityAdmin } from "./identity-admin.js";
import type { UserAdminRepository } from "./user-admin.repository.js";

export class UserAdminService {
  constructor(
    private readonly repository: UserAdminRepository,
    private readonly identityAdmin: IdentityAdmin,
    private readonly passwordResetSender: PasswordResetSender,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.repository.findAll();
  }

  async getById(id: string) {
    const user = await this.repository.findById(id);
    if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);
    return user;
  }

  async create(data: CreateUserAdminDto, context: AuthenticatedAuditContext) {
    if (await this.repository.findByEmail(data.email)) {
      throw new AppError("USER_EMAIL_ALREADY_EXISTS", "A user with this email already exists", 409);
    }

    if (!await this.repository.roleExists(data.roleId)) {
      throw new AppError("ROLE_NOT_FOUND", "Role not found", 404);
    }

    const firebaseUid = randomUUID();
    let localUserId: string | undefined;
    let identityCreated = false;
    let createdUser: Awaited<ReturnType<UserAdminRepository["create"]>> | undefined;

    try {
      createdUser = await this.repository.create({ ...data, firebaseUid });
      localUserId = createdUser.id;

      await this.identityAdmin.createUser({
        uid: firebaseUid,
        email: data.email,
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      });
      identityCreated = true;

      await this.passwordResetSender.send(data.email);
    } catch (error) {
      if (identityCreated) {
        try { await this.identityAdmin.deleteUser(firebaseUid); } catch { /* preserve original error */ }
      }
      if (localUserId) {
        try { await this.repository.delete(localUserId); } catch { /* preserve original error */ }
      }
      throw error;
    }

    if (!createdUser) {
      throw new Error("User provisioning finished without a local user");
    }

    await this.audit.record(context, {
      action: "USER_CREATED",
      resourceType: "user",
      resourceId: createdUser.id,
      metadata: {
        initialStatus: createdUser.status,
        roleCode: createdUser.role?.code ?? null,
        passwordSetupSent: true,
      },
    });

    return createdUser;
  }

  async update(
    id: string,
    data: UpdateUserAdminDto,
    context: AuthenticatedAuditContext,
  ) {
    const current = await this.getById(id);

    if (data.email !== undefined && data.email !== current.email) {
      const duplicate = await this.repository.findByEmail(data.email);
      if (duplicate && duplicate.id !== id) {
        throw new AppError("USER_EMAIL_ALREADY_EXISTS", "A user with this email already exists", 409);
      }
    }

    await this.identityAdmin.updateUser(current.firebaseUid, data);

    let updated;
    try {
      updated = await this.repository.update(id, data);
    } catch (error) {
      try {
        await this.identityAdmin.updateUser(current.firebaseUid, {
          email: current.email,
          displayName: current.displayName,
        });
      } catch { /* best-effort compensation */ }
      throw error;
    }

    await this.audit.record(context, {
      action: "USER_UPDATED",
      resourceType: "user",
      resourceId: updated.id,
      metadata: {
        changedFields: Object.keys(data).sort(),
      },
    });

    return updated;
  }

  async activate(id: string, context: AuthenticatedAuditContext) {
    const current = await this.getById(id);
    await this.identityAdmin.setDisabled(current.firebaseUid, false);

    let activated;
    try {
      activated = await this.repository.setStatus(id, "ACTIVE");
    } catch (error) {
      try { await this.identityAdmin.setDisabled(current.firebaseUid, true); } catch { /* best-effort compensation */ }
      throw error;
    }

    await this.audit.record(context, {
      action: "USER_ACTIVATED",
      resourceType: "user",
      resourceId: activated.id,
      metadata: {
        previousStatus: current.status,
        newStatus: activated.status,
      },
    });

    return activated;
  }

  async suspend(id: string, context: AuthenticatedAuditContext) {
    const current = await this.getById(id);
    if (current.id === context.actorUserId) {
      throw new AppError("USER_CANNOT_SUSPEND_SELF", "You cannot suspend your own user", 409);
    }
    if (await this.repository.userHasRole(id, "admin") && await this.repository.countActiveUsersWithRole("admin") <= 1) {
      throw new AppError("LAST_ADMIN_PROTECTED", "The last active administrator cannot be suspended", 409);
    }

    const suspended = await this.repository.setStatus(id, "SUSPENDED");
    // Local status is the authoritative access gate. Keep it suspended even if
    // Firebase synchronization fails, so already-issued tokens stay blocked.
    await this.identityAdmin.setDisabled(current.firebaseUid, true);

    await this.audit.record(context, {
      action: "USER_SUSPENDED",
      resourceType: "user",
      resourceId: suspended.id,
      metadata: {
        previousStatus: current.status,
        newStatus: suspended.status,
      },
    });

    return suspended;
  }

  async resendPasswordSetup(id: string, context: AuthenticatedAuditContext) {
    const current = await this.getById(id);
    await this.passwordResetSender.send(current.email);

    await this.audit.record(context, {
      action: "USER_PASSWORD_SETUP_SENT",
      resourceType: "user",
      resourceId: current.id,
      metadata: {
        channel: "email",
      },
    });
  }
}
