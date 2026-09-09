import { z } from "zod";

export const assignmentIdParamsSchema = z.object({ id: z.string().uuid() });
export const replaceUserRoleSchema = z.object({ roleId: z.string().uuid() });
