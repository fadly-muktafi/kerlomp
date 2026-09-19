import { z } from "zod";

export const commentSchema = z.object({
  groupId: z.uuid(),
  subTaskId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Komentar wajib diisi")
    .max(2000, "Komentar maksimal 2000 karakter"),
});