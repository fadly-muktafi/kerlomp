import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/features/auth/google-sign-in-button";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  const hasError = params.error !== undefined;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h2 text-ink">Masuk ke Kerlomp</h1>
        <p className="text-body text-ink-muted">
          Satu klik pakai Google. Tanpa bikin password baru.
        </p>
      </div>
      {hasError ? (
        <p className="text-small text-danger" role="alert">
          Gagal masuk tadi. Coba lagi ya.
        </p>
      ) : null}
      <GoogleSignInButton next={next} />
    </main>
  );
}