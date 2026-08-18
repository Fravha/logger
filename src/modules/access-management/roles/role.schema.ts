import { z } from "zod";

export const roleIdParamsSchema = z.object({ id: z.string().uuid() });

export const createRoleSchema = z.object({
  code: z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9:_-]*$/, "Code must use lowercase letters, numbers, colon, underscore or dash"),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });
