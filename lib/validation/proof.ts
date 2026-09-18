import { z } from "zod";

export const PROOF_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
};

export const MAX_PROOF_BYTES = 10 * 1024 * 1024;
export const MAX_PROOF_FILES = 3;

export const proofFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(MAX_PROOF_BYTES, "File maksimal 10MB"),
  mime: z.string().min(1),
});

export type ProofFileInput = z.infer<typeof proofFileSchema>;

export const submitProofSchema = z.object({
  groupId: z.uuid(),
  subTaskId: z.uuid(),
  note: z
    .string()
    .trim()
    .min(10, "Bukti teks minimal 10 karakter")
    .max(2000, "Bukti teks maksimal 2000 karakter"),
  files: z.array(proofFileSchema).max(MAX_PROOF_FILES, "Maksimal 3 file"),
});

export const uploadMetaSchema = z.object({
  groupId: z.uuid(),
  subTaskId: z.uuid(),
  name: z.string().min(1).max(255),
  mime: z.string().min(1),
  size: z.number().int().positive().max(MAX_PROOF_BYTES, "File maksimal 10MB"),
});

export const reviewSchema = z.object({
  groupId: z.uuid(),
  submissionId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(2000).optional(),
});