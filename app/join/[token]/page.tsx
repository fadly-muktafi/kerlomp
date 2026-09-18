import type { Metadata } from "next";
import Link from "next/link";
import { getInviteByToken } from "@/lib/data/groups";
import { getSession } from "@/lib/auth/dal";
import { GuestJoinForm } from "@/components/features/join/guest-join-form";

export const metadata: Metadata = { title: "Gabung grup" };

export default async function JoinPage({
  params,
  searchParams,
}: PageProps<"/join/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="font-display text-h2 text-ink">Link tidak berlaku</h1>
        <p className="text-body text-ink-muted">
          Link undangan ini sudah tidak aktif. Minta link baru ke leader grup.
        </p>
        <Link
          href="/"
          className="text-small font-medium text-accent underline-offset-4 hover:underline"
        >
          Kembali ke beranda
        </Link>
      </main>
    );
  }

  const session = await getSession();

  if (session) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-h2 text-ink">
            Gabung ke {invite.name}
          </h1>
          <p className="text-body text-ink-muted">
            Kamu sudah masuk. Klik tombol untuk bergabung ke grup ini.
          </p>
        </div>
        <form action="/api/join" method="post">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-md bg-accent px-5 font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98]"
          >
            Gabung sekarang
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h2 text-ink">
          Gabung ke {invite.name}
        </h1>
        <p className="text-body text-ink-muted">
          Cukup masukkan nama. Nggak perlu bikin akun.
        </p>
      </div>
      <GuestJoinForm token={token} error={error} />
    </main>
  );
}