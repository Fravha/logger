import { z } from "zod";

export const assignmentIdParamsSchema = z.object({ id: z.string().uuid() });
export const replaceUserRolesSchema = z.object({ roleIds: z.array(z.string().uuid()).max(100) });
export const replaceRolePermissionsSchema = z.object({ permissionIds: z.array(z.string().uuid()).max(500) });