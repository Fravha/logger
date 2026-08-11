import type { AuthIdentity } from "../../modules/auth/auth.types.js";
import type { AuthenticatedUser } from "../../modules/users/user.types.js";

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
