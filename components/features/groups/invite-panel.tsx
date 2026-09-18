"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { regenerateInvite } from "@/lib/groups/actions";
import { Button } from "@/components/ui/button";

export function InvitePanel({
  groupId,
  inviteToken,
}: {
  groupId: string;
  inviteToken: string;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/join/${inviteToken}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(path, window.location.origin).toString(),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bisa ditolak; user masih bisa menyalin manual.
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <h2 className="font-display text-h3 font-medium text-ink">
        Undang anggota
      </h2>
      <p className="text-small text-ink-muted">
        Bagikan link ini. Siapa pun yang membukanya bisa gabung tanpa bikin akun.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-sm border border-line bg-surface-2 px-3 py-2 font-mono text-small text-ink">
          {path}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
          {copied ? (
            <Check size={16} weight="bold" aria-hidden />
          ) : (
            <Copy size={16} weight="regular" aria-hidden />
          )}
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
      <form action={regenerateInvite} className="flex flex-col gap-2">
        <input type="hidden" name="groupId" value={groupId} />
        <Button type="submit" variant="ghost" size="sm" className="self-start">
          Buat ulang link
        </Button>
        <p className="text-small text-ink-muted">
          Membuat ulang akan mematikan link lama.
        </p>
      </form>
    </section>
  );
}