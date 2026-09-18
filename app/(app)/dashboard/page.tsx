import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-h2 text-ink">
          Halo, {profile?.display_name ?? "kamu"}
        </h1>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Keluar
          </Button>
        </form>
      </header>
      <p className="text-body text-ink-muted">
        Dashboard masih kosong. Daftar dan pembuatan grup menyusul di tahap berikutnya.
      </p>
    </main>
  );
}