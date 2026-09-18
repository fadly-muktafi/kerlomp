import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama grup wajib diisi")
    .max(120, "Nama grup maksimal 120 karakter"),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter").optional(),
  ),
  deadline: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid")
      .optional(),
  ),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const guestNameSchema = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi")
  .max(40, "Nama maksimal 40 karakter");