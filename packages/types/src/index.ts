import { z } from "zod";

export const OrderSchema = z.object({
  type: z.enum(["MARKET", "LIMIT", "SNIPER"]),
  side: z.enum(["BUY", "SELL"]),
  asset: z.string(),
  amount: z.number().positive(),
  limitPrice: z.number().optional(),
});

export type OrderInput = z.infer<typeof OrderSchema>;
