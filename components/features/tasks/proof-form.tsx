"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitProof } from "@/lib/groups/proof-actions";
import { Button } from "@/components/ui/button";
import { MAX_PROOF_FILES } from "@/lib/validation/proof";

type FileMeta = { path: string; name: string; size: number; mime: string };

export function ProofForm({
  groupId,
  subTaskId,
}: {
  groupId: string;
  subTaskId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const note = String(data.get("note") ?? "");
    const files = (data.getAll("files") as File[])
      .filter((file) => file instanceof File && file.size > 0)
      .slice(0, MAX_PROOF_FILES);

    startTransition(async () => {
      const supabase = createClient();
      const metas: FileMeta[] = [];

      for (const file of files) {
        const response = await fetch("/api/proofs/sign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId,
            subTaskId,
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.error ?? "Gagal menyiapkan unggahan.");
          return;
        }

        const { path, token } = (await response.json()) as {
          path: string;
          token: string;
        };
        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .uploadToSignedUrl(path, token, file);

        if (uploadError) {
          setError("Gagal mengunggah file.");
          return;
        }
        metas.push({ path, name: file.name, size: file.size, mime: file.type });
      }

      const payload = new FormData();
      payload.set("groupId", groupId);
      payload.set("subTaskId", subTaskId);
      payload.set("note", note);
      payload.set("files", JSON.stringify(metas));

      const result = await submitProof(undefined, payload);
      if (result?.error) {
        setError(result.error);
        return;
      }

      form.reset();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4"
    >
      <label className="flex flex-col gap-2">
        <span className="text-small font-medium text-ink">Bukti pekerjaan</span>
        <textarea
          name="note"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          placeholder="Jelaskan hasilnya, minimal 10 karakter"
          className="rounded-sm border border-line bg-surface px-3 py-2 text-body text-ink"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-small font-medium text-ink">
          File bukti (opsional, maks 3, maks 10MB)
        </span>
        <input
          type="file"
          name="files"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.pptx"
          className="text-small text-ink-muted"
        />
      </label>
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Mengirim..." : "Serahkan bukti"}
      </Button>
    </form>
  );
}