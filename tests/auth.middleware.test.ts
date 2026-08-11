import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractBearerToken } from "../src/modules/auth/auth.middleware.js";
import { AppError } from "../src/shared/errors/app-error.js";

describe("extractBearerToken", () => {
  it("extracts a strict bearer token", () => {
    assert.equal(extractBearerToken("Bearer firebase-token"), "firebase-token");
  });

  for (const authorization of [undefined, "", "bearer token", "Bearer", "Bearer  token", "Basic token"]) {
    it(`rejects ${String(authorization)}`, () => {
      assert.throws(
        () => extractBearerToken(authorization),
        (error: unknown) => error instanceof AppError && error.statusCode === 401,
      );
    });
  }
});
