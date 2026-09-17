import { cookies } from "next/headers";

export const GUEST_COOKIE = "kerlomp_guest";
export const INTENT_COOKIE = "kerlomp_intent";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Simpan identitas guest (dipanggil dari guest-session flow). */
export async function setGuestCookie(token: string) {
  const store = await cookies();
  store.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
}

export async function getGuestToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value ?? null;
}

export async function clearGuestCookie() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
}

/** Simpan intent join (dipakai setelah OAuth untuk redirect-perlukan). */
export async function setJoinIntentCookie(inviteToken: string) {
  const store = await cookies();
  store.set(INTENT_COOKIE, `join:${inviteToken}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 15, // 15 menit cukup untuk menyelesaikan OAuth
    path: "/",
  });
}

export async function consumeJoinIntent(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(INTENT_COOKIE)?.value;
  if (!raw?.startsWith("join:")) return null;
  store.delete(INTENT_COOKIE);
  return raw.slice(5);
}
