import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env/client";
import type { Database } from "@/lib/supabase/types";

/**
 * Refresh sesi Supabase di setiap request (pola resmi @supabase/ssr).
 * Next.js 16: `middleware.ts` diganti `proxy.ts`, runtime nodejs (bukan edge).
 * Bukan gate auth - proteksi route dilakukan di DAL / page server-side.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // Header cache dari library WAJIB diteruskan: response bersesi tidak
          // boleh di-cache CDN/proxy (bisa membocorkan sesi ke user lain).
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              supabaseResponse.headers.set(key, value);
            }
          }
        },
      },
    },
  );

  // getClaims memverifikasi tanda tangan token (lokal via JWKS untuk kunci
  // asimetris), bukan sekadar membaca cookie. Jangan pakai getSession di server.
  await supabase.auth.getClaims();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};