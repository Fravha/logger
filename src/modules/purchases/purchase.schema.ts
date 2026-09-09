import { z } from "zod";

const monetaryAmount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Total must have at most 2 decimal places");

export const purchaseIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createPurchaseSchema = z.object({
  reference: z.string().trim().min(1, "Reference is required").max(50),
  supplierName: z.string().trim().min(1, "Supplier name is required").max(150),
  total: monetaryAmount,
  purchasedAt: z.coerce.date(),
});

export const updatePurchaseSchema = createPurchaseSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);
