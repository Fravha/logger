import type { AuthenticatedUser } from "../users/user.types.js";

export class AccessControlService {
  hasRole(user: AuthenticatedUser, role: string) {
    return user.roles.includes(role);
  }

  hasPermission(user: AuthenticatedUser, permission: string) {
    return user.permissions.includes(permission);
  }

  hasAnyPermission(user: AuthenticatedUser, permissions: readonly string[]) {
    return permissions.some((permission) => this.hasPermission(user, permission));
  }
}
