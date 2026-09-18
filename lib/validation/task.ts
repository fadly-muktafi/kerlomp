import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const createSubTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul tugas wajib diisi")
    .max(200, "Judul maksimal 200 karakter"),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter").optional(),
  ),
  assigneeId: z.uuid("Pilih anggota yang bertugas"),
  deadline: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid")
      .optional(),
  ),
});

export type CreateSubTaskInput = z.infer<typeof createSubTaskSchema>;