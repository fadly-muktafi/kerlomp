import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-[100dvh] bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link
            href="/dashboard"
            className="font-display text-h3 font-bold text-ink"
          >
            Kerlomp
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[20ch] truncate text-small text-ink-muted sm:inline">
              {profile?.display_name}
            </span>
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Keluar
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}