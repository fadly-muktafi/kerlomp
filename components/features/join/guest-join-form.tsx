import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GuestJoinForm({
  token,
  error,
}: {
  token: string;
  error: string | null;
}) {
  return (
    <form action="/api/join" method="post" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Input
        label="Nama kamu"
        name="name"
        placeholder="Misal: Rani"
        required
        maxLength={40}
        error={error ?? undefined}
      />
      <Button type="submit" className="self-start">
        Gabung
      </Button>
      <p className="text-small text-ink-muted">
        Tanpa akun. Kalau nanti mau ikut mengubah status, kamu bisa masuk pakai
        Google.
      </p>
    </form>
  );
}