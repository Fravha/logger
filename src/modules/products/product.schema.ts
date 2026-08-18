import { z } from "zod";

export const productIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createProductSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(50, "Code must be at most 50 characters"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(150, "Name must be at most 150 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters")
    .optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Price must have at most 2 decimal places"),
});

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    description: z
      .string()
      .trim()
      .max(500, "Description must be at most 500 characters")
      .nullable()
      .optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
