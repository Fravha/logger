import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccessControlService } from "../src/modules/access-control/access-control.service.js";
import type { AuthenticatedUser } from "../src/modules/users/user.types.js";

const user: AuthenticatedUser = {
  id: "user-id",
  firebaseUid: "firebase-id",
  email: "user@example.com",
  displayName: null,
  status: "ACTIVE",
  roles: ["admin"],
  permissions: ["users:read", "users:manage"],
};

describe("AccessControlService", () => {
  const service = new AccessControlService();

  it("evaluates roles", () => {
    assert.equal(service.hasRole(user, "admin"), true);
    assert.equal(service.hasRole(user, "auditor"), false);
  });

  it("evaluates one or multiple permissions", () => {
    assert.equal(service.hasPermission(user, "users:read"), true);
    assert.equal(service.hasPermission(user, "rbac:manage"), false);
    assert.equal(service.hasAnyPermission(user, ["rbac:manage", "users:manage"]), true);
  });
});
