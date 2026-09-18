"use client";

import { GoogleLogo } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" disabled={pending} className="w-full">
      <GoogleLogo size={20} weight="bold" aria-hidden />
      {pending ? "Menghubungkan..." : "Lanjut dengan Google"}
    </Button>
  );
}

export function GoogleSignInButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton />
    </form>
  );
}