import { z } from "zod";

const page = z.coerce.number().int().min(1).max(10_000).default(1);
export const PresenceQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  worker_page: page,
  client_page: page,
  admin_page: page,
});
export type PresenceQuery = z.infer<typeof PresenceQuerySchema>;
