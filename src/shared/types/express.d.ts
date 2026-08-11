import type { AuthIdentity } from "../../core/auth/auth.types.js";
import type { AuthenticatedUser } from "../../core/users/user.types.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authIdentity?: AuthIdentity;
      currentUser?: AuthenticatedUser;
    }
  }
}

export {};
