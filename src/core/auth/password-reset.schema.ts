import { z } from "zod";
export const passwordResetSchema = z.object({
  email: z.string().trim().email().max(320),
});
