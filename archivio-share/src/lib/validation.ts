import { z } from "zod";

// API input validation schemas — extended in later todos
export const uploadBodySchema = z.object({
  photoId: z.string().min(1),
  shortCode: z.string().length(8),
  timestamp: z.coerce.number(),
  signature: z.string().min(1),
});

export const capsuleBodySchema = z.object({
  photoId: z.string().min(1),
  email: z.string().email(),
  message: z.string().max(500),
  deliveryOption: z.enum(["1week", "3months", "6months", "1year", "custom"]),
  deliverAt: z.coerce.number(),
  includeTemplate: z.boolean().optional(),
  emailTemplateId: z.string().optional(),
});
