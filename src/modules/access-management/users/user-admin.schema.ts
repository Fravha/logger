import { z } from "zod";

export const userAdminIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createUserAdminSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(150).optional(),
  roleIds: z.array(z.string().uuid()).max(50).optional(),
});

export const updateUserAdminSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  displayName: z.string().trim().min(1).max(150).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});
