import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import { createAuthRouter } from "../src/modules/auth/auth.routes.js";
import type { TokenVerifier } from "../src/modules/auth/auth.types.js";
import type { UserRepository } from "../src/modules/users/user.repository.js";
import type { AuthenticatedUser } from "../src/modules/users/user.types.js";
import { AppError } from "../src/shared/errors/app-error.js";

const activeUser: AuthenticatedUser = {
  id: "user-id",
  firebaseUid: "firebase-id",
  email: "user@example.com",
  displayName: "Logger User",
  status: "ACTIVE",
  roles: ["admin"],
  permissions: ["users:read"],
};

const verifier: TokenVerifier = {
  async verify(token) {
    assert.equal(token, "valid-token");
    return { uid: "firebase-id", email: "user@example.com" };
  },
};

async function requestMe(user: AuthenticatedUser | null) {
  const repository: UserRepository = { async findByFirebaseUid() { return user; } };
  const app = express();
  app.use("/api/v1/auth", createAuthRouter(verifier, repository));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "Unexpected", 500);
    res.status(appError.statusCode).json({ error: { code: appError.code } });
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    return await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`, {
      headers: { authorization: "Bearer valid-token" },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("GET /api/v1/auth/me", () => {
  it("returns the active local user with RBAC", async () => {
    const response = await requestMe(activeUser);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), activeUser);
  });

  it("denies Firebase identities that are not provisioned locally", async () => {
    const response = await requestMe(null);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: { code: "AUTH_USER_NOT_REGISTERED" } });
  });
});
