# Kerlomp — Technical Architecture

> **Versi:** 1.0 · **Basis keputusan:** PRD.md v1.0 · DESIGN.md v1.0
> **Stack:** Next.js (App Router) · Supabase (Auth / Postgres / Realtime / Edge Functions / Cron) · Tailwind CSS v4 · Vercel (hosting)

---

## 1. Gambaran Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  Next.js RSC (data awal) + Client Components (interaksi)        │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ Google OAuth │  │ Realtime channels │  │ Optimistic update │  │
│  │ (PKCE)       │  │ (per grup + user) │  │ (task status)     │  │
│  └──────┬───────┘  └────────┬─────────┘  └─────────┬─────────┘  │
└─────────┼───────────────────┼──────────────────────┼───────────┘
          │                   │ WSS                  │
          ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SUPABASE                               │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   Auth    │ │   Postgres   │ │  Realtime   │ │ Edge Funcs  │ │
│  │ Google   │ │  + RLS       │ │ (postgres_  │ │ - join      │ │
│  │ OAuth    │ │              │ │  changes)   │ │ - guest-me  │ │
│  └──────────┘ └──────────────┘ └─────────────┘ │ - claim     │ │
│                                                │ - remind    │ │
│  ┌────────────────────────────────────────┐   │   (cron)    │ │
│  │  Supabase Cron → reminder tick (15m)   │───┴─────────────┘ │
│  └────────────────────────────────────────┘          │         │
└──────────────────────────────────────────────────────│─────────┘
                                                       ▼
                                          ┌────────────────────┐
                                          │  WA Provider (abstr.)│
                                          │  Meta Cloud API /   │
                                          │  OpenWA self-host   │
                                          └────────────────────┘
```

**Prinsip arsitektur:**
1. **Server Components untuk baca awal, Realtime untuk delta.** Tidak ada polling custom.
2. **Semua write sensitif lewat Postgres + RLS.** Client tidak pernah pegang service key.
3. **Guest = Edge Function keyed-by-token, bukan akun.** Guest tidak punya JWT Supabase.
4. **Satu arah data:** Server renders → client hydrates → realtime merges. Tidak ada dua sumber kebenaran.

---

## 2. Struktur Proyek (Next.js App Router)

```
kerlomp/
├── proxy.ts                      # Next 16: refresh sesi Supabase (pengganti middleware.ts, runtime nodejs)
├── next.config.ts                # optimizePackageImports, reactCompiler, images.remotePatterns
├── app/
│   ├── (marketing)/              # Landing, halaman statis (SEO)
│   │   ├── page.tsx              # Hero, fitur, FAQ — server-rendered
│   │   └── layout.tsx
│   ├── (auth)/
│   │   └── login/page.tsx        # Satu tombol "Lanjut dengan Google" (URL: /login)
│   ├── auth/
│   │   └── callback/route.ts     # OAuth callback (URL: /auth/callback) → post-auth router
│   ├── (app)/
│   │   ├── layout.tsx            # App shell: sidebar grup, notif bell
│   │   ├── dashboard/page.tsx    # "Tugasku" lintas grup
│   │   └── g/[groupId]/
│   │       ├── page.tsx          # Board grup: progress + sub-tasks
│   │       └── tasks/[taskId]/page.tsx  # Detail + komentar
│   ├── join/[token]/page.tsx     # Guest join (nama only) atau redirect login
│   └── settings/page.tsx         # Profil + nomor WA opt-in
├── components/                   # UI (tokens dari DESIGN.md)
│   ├── ui/                       # primitives: Button, Input, Badge, Card
│   ├── realtime/                 # providers & hooks
│   │   └── realtime-provider.tsx # "use client", satu root channel manager
│   └── features/                 # task-row, progress-bar, comment-list, dll
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # createServerClient (cookies)
│   │   ├── client.ts             # browser client
│   │   └── admin.ts              # service-role (hanya di route/edge, tidak diimport client)
│   ├── wa/
│   │   ├── sender.ts             # interface WASender
│   │   ├── meta-cloud.ts         # impl: Meta WhatsApp Cloud API
│   │   └── openwa.ts             # impl: OpenWA (anti-ban pacing)
│   └── id/                       # guest-token utils, token invite gen
├── supabase/
│   ├── migrations/               # SQL DDL + RLS (mirror SCHEMA.md)
│   └── functions/
│       ├── join-accept/          # verify invite token, insert member
│       ├── guest-session/        # mint cookie http-only guest
│       ├── guest-claim/          # merge guest → auth.users
│       └── remind-tick/          # cron target, enqueue + send reminders
├── tests/                        # Playwright (E2E kritikal) + vitest (RLS rules)
└── (docs root) PRD.md DESIGN.md ARCHITECTURE.md SCHEMA.md RULES.md
```

**Konfigurasi Next.js 16 (`next.config.ts`):** `experimental.optimizePackageImports: ['@phosphor-icons/react']` (hindari barrel import cost; masih experimental di 16.3.5), `reactCompiler: true` (dev dep `babel-plugin-react-compiler`), `images.remotePatterns` untuk `lh3.googleusercontent.com` (avatar Google) dan host Storage Supabase.

---

## 3. Autentikasi & Identitas

### 3.1 Google OAuth (satu-satunya login)

```
User → GET /auth/google (Supa signInWithOAuth) → Google consent
    → Supabase redirect ke /auth/callback?code=…
    → exchangeCodeForSession(code) (PKCE, cookie session)
    → upsert profiles (id, display_name dari metadata Google, avatar_url)
    → redirect sesuai konteks:
        - bawa cookie `kerlomp_intent=join:<token>` → POST Edge join-accept → /g/<group>
        - default → /dashboard
```

- Session: refresh token Supabase, cookie httpOnly SameSite=Lax; umur ≥ 30 hari (refresh berjalan).
- Refresh sesi dijalankan di `proxy.ts` (Next 16 menggantikan `middleware.ts`; runtime `nodejs`, bukan `edge`).
- Saat leader membuat grup, trigger `on_group_created` otomatis menambahkan baris `members` untuk leader (SCHEMA.md §6.4). Karena itu Edge `join-accept` wajib memakai `on conflict (group_id, user_id) do nothing`.
- Tidak ada email/password, tidak ada provider lain.

### 3.2 Guest (nama saja) — "Join tanpa ribet"

```
GET /join/<invite_token>
 ├─ Sudah login? → Edge join-accept → anggota → redirect /g/<group>
 └─ Belum login:
     ├─ tampilkan form satu input (nama)  [halaman /join]
     └─ submit → Edge guest-session:
           • verifikasi invite_token masih valid & grup ada
           • buat members row: user_id=NULL, guest_name=<nama>, guest_token=uuid
           • set cookie `kerlomp_guest=<token>; HttpOnly; Sec; SameSite=Lax; Max-Age=30d`
           • redirect /g/<group>  (read-only)
```

**Izinkan guest:** `SELECT` rows grup sendiri via Edge read-only (lihat §5.2) atau proxy read. Guest **tidak bisa** insert/update apapun di DB langsung.

### 3.3 Claim flow (guest → akun)

Trigger: guest menekan aksi interaktif (update status / komentar) → prompt "Masuk Google dulu yuk" → redirect `/login?next=/claim&intent=join:<token>`:

```
OAuth sukses → Edge guest-claim (transaksi):
  1. baca cookie kerlomp_guest → cari members row (guest_token, user_id IS NULL)
  2. pastikan auth.uid() belum ada di members grup itu (kalau ada → tolak: "akun ini sudah di grup")
  3. UPDATE members SET user_id=auth.uid(), guest_token=NULL
       + re-point semua sub_tasks.assignee (yang menunjuk row members) — benar karena assignee_id
         menunjuk members.id, bukan user_id mentah (lihat SCHEMA.md)
  4. hapus cookie guest; redirect /g/<group>
```

Update display name: prefer nama Google jika ada, fallback `guest_name` lama.

### 3.4 Mengapa bukan Supabase Anonymous Sign-in?

Karena "tanpa login" adalah janji produk: user tak boleh merasa dipaksa bikin akun. Guest-token membuat identitas jelas terpisah dari auth.users — lebih mudah di-audit, RLS tidak ambigu, dan ketika dibersihkan (guest kadaluarsa) tidak menyentuh tabel auth.

---

## 4. Data Flow & Realtime

### 4.1 Bacaan awal (Server-side)

```
RSC page → createServerClient(cookies) → query grup + members + sub_tasks (1 request via join/embedding)
        → render penuh (no loading spinner) → kirim HTML
```

Snapshot ini disertai `updated_at` tertinggi per entity → dipakai client sebagai watermark.

### 4.2 Realtime subscription (Client)

Satu Client Provider `"use client"` di `(app)/layout.tsx`:

```
channel per user:  user:<uid>            → notifications
channel per grup:  group:<group_id>      → sub_tasks, submissions, comments, members
event: postgres_changes, filter sesuai; payload id → refetch-or-merge
```

**Strategi merge:**
- **Update status sub-task:** optimistic di actor (tandai pending); di client lain apply langsung; watermark `updated_at` mencegah balik-urut.
- **Komentar:** append by `created_at, id`.
- **Members/progress:** dihitung ulang dari snapshot (agregasi `count by status` di server, cache 5 detik; realtime invalidasi saja).

**Reconnect & offline:** status koneksi Supabase `SUBSCRIBED|CLOSED|CHANNEL_ERROR` dipetakan ke UI badge; saat kembali `SUBSCRIBED` → full re-fetch watermark check.

### 4.3 Throughput safeguard

- Realtime listen hanya kolom yang dipakai UI (select explicit).
- Tidak ada broadcast per keystroke (tidak ada typing indicator di MVP).
- Channel per grup ⇒ grup besar tidak menyebarkan noise ke seluruh sistem.

---

## 5. Otorisasi (Ringkasan; detail SQL di SCHEMA.md)

### 5.1 Prinsip
- **RLS ON di semua tabel.** Tidak ada `using (true)`.
- Role client: `authenticated` (akun Google). Guest tidak authenticated.
- `service_role` hanya hidup di Edge Functions / route handlers server — tidak pernah di-bundle ke client (guard: `server-only` package).

### 5.2 Matrix izin

| Aksi | Leader | Member (login) | Guest |
|---|---|---|---|
| Baca grup/member/subtask/komentar grup sendiri | ✅ | ✅ | ✅ (read-only, via fungsi `is_guest(group, token)`) |
| Buat/edit/hapus grup & sub-task, ubah assignee | ✅ | ❌ | ❌ |
| Update `sub_tasks.status` (`todo`↔`in_progress`) | ✅ (semua) | ✅ hanya miliknya | ❌ |
| Transisi `in_progress`→`submitted` (wajib bukti) | ✅ | ✅ hanya miliknya | ❌ |
| Approve/Reject bukti | ✅ saja | ❌ | ❌ |
| Upload/hapus file bukti di bucket `proofs` | ✅ | ✅ hanya task miliknya | ❌ |
| Tulis komentar | ✅ | ✅ | ❌ |
| Hapus komentar | ✅ | ✅ milik sendiri | ❌ |
| Kelola undangan (regenerate/revoke) | ✅ | ❌ | ❌ |
| Set nomor WA | ✅ (miliknya) | ✅ (miliknya) | ❌ |

- Guest read dibantu SECURITY DEFINER function yang memverifikasi cookie `kerlomp_guest` ⇐ ditanyakan pada setiap query RLS via `current_setting('request.headers')`, atau lebih bersih: **guest read terjadi di server component** pakai cookie → service-role-render → kirim HTML. (Pilihan ini menghilangkan kebutuhan RLS guest paths; diputuskan di SCHEMA.md phase implementasi. Default arsitektur: **server-rendered guest read**, tanpa service key di middleware.)

---

## 6. Reminder Pipeline

```
Supabase Cron (*/15 * * * *)  →  Edge remind-tick()
  1. SELECT sub_tasks WHERE status IN ('todo','in_progress') AND deadline IN (H-1 window, H-0 window)
     -- status 'submitted' tidak di-remind (beban sudah pindah ke leader untuk review)
     AND NOT EXISTS reminder_log(sub_task, window)
  2. Untuk setiap assignee:
       ├─ INSERT notifications (in-app, idempotent via unique key)
       └─ Jika user.wa_opt_in → enqueue WA via WASender.send(to, template)
  3. INSERT reminder_log (sub_task_id, window, sent_at, provider, status)
```

- **Idempotensi:** unique constraint `(sub_task_id, window)` di `reminder_log` — cron dobel tidak akan kirim ulang.
- **Retry:** status `failed` dicoba ulang maks 3× backoff (5m, 30m, 2h); setelah itu flag manual.
- **Rate control (anti-ban OpenWA):** jeda acak 3–8 detik antar pesan, batch ≤ 20 pesan/menit per nomor pengirim, daily cap 2 per user.
- **Storage bukti:** Supabase Storage bucket privat `proofs`, path `proofs/<group_id>/<sub_task_id>/<file_name>`; upload via server route (validasi MIME + magic bytes + ≤10MB + maks 3 file), baca via signed URL umur ≤ 60 menit. Storage RLS: tulis hanya assignee (login) / leader grup; baca anggota grup login saja.
- **Abstraksi provider:**

```ts
// lib/wa/sender.ts
export interface WASender {
  sendReminder(to: string, template: ReminderPayload): Promise<DeliveryResult>;
}
// dipilih via env: WA_PROVIDER=meta | openwa
```

---

## 7. Variabel Lingkungan (env)

```
NEXT_PUBLIC_SUPABASE_URL          # public, aman
NEXT_PUBLIC_SUPABASE_ANON_KEY     # public, aman (RLS yang melindungi)
SUPABASE_SERVICE_ROLE_KEY         # HANYA di server/edge — dilarang impor client
GOOGLE_OAUTH_CLIENT_ID/SECRET     # via dashboard Supabase, bukan env app
WA_PROVIDER                       # meta | openwa
META_WA_TOKEN / META_WA_PHONE_ID  # jika meta
OPENWA_API_URL / OPENWA_API_KEY   # jika openwa (self-host)
RESEND_FROM (atau mailer lain)    # TBD: hanya jika verifikasi email dibutuhkan
```

Aturan: semua secret divalidasi di boot server (`zod` parse); jika WA env tidak lengkap → fitur WA dimatikan graceful, UI menampilkan "coming soon" pada setting.

---

## 8. Deployment

- **App:** Vercel (region `sin1` jika tersedia untuk latency Indonesia).
- **DB & Auth & Realtime & Edge:** Supabase (project region Singapore).
- **Cron:** `supabase/cron` schedules (pg_cron) memanggil Edge Function `remind-tick`.
- **OpenWA (jika fallback):** Docker container self-host (Railway/Fly/VPS), single-session QR pairing; dipisah dari Vercel karena stateful.
- **Checklist deploy:** redirect URL Google tercatat (`https://<domain>/auth/callback`), SITE_URL benar, env parity staging↔prod, RLS migration applied, cron live.

---

## 9. Testing Strategy

| Level | Alat | Fokus |
|---|---|---|
| Unit | Vitest | utils: merge realtime payload, watermark, format deadline |
| RLS policy | `supabase tests` (pgTAP) atau script vitest + sql | **Wajib lulus sebelum merge:** membaca lintas grup diblok; guest tidak bisa write; hanya assignee update status |
| Integration | Playwright | join-guest → claim OAuth (mock) → status update muncul di tab kedua ≤ 2s |
| E2E kritis | Playwright | leader buat grup → bagikan link → guest join → assign task → status → reminder dipicu (stub WA) |
| Perf | Lighthouse CI | Perf ≥ 90, A11y = 100 |

Test Progressive Web App/offline ditunda sesudah v1.1.

---

## 10. Batasan & Keputusan Non-Goals Arsitektur

- Tidak ada WebSocket server custom — Realtime Supabase cukup.
- Tidak ada service workers/push notifications di MVP.
- Tidak ada cache Redis; watermark + Realtime cukup pada skala target.
- TIDAK pernah menaruh `service_role` key ke dalam kode client atau repo public; `.env*` di-ignore, di-set via dashboard Vercel/Supabase.

---

## 11. Keputusan Tercatat (ADR ringkas)

| # | Keputusan | Alasan | Alternatif ditolak |
|---|---|---|---|
| 1 | Guest = token cookie, bukan anon-auth | Kejelasan identitas, RLS sederhana, hapus bersih | Supabase anonymous sign-in |
| 2 | Claim via members row (assignee → members.id, bukan user_id) | Klaim tidak memindahkan FK sub-tasks | assignee langsung ke auth.users |
| 3 | Realtime via channel per-grup | Isolasi noise, mudah dibersihkan | satu channel global |
| 4 | WA via abstraksi, dual-provider | Biaya & risiko ban | Kunci ke satu vendor |
| 5 | Cron 15 menit di Supabase | Simpan operasi, native dari stack | Queue eksternal (BullMQ dll) |
| 6 | Server-render guest read | Meniadakan jalur RLS guest | RLS via header JWT guest |
| **→ 6 butuh verifikasi saat implementasi SCHEMA.md** | detail fungsi SECURITY DEFINER akan diputuskan di SCHEMA.md sesuai hasil prototyping | | |
| 7 | Bukti & approval masuk scope MVP (PRD Epic F) | Mencegah klaim selesai tanpa bukti; 4 status sudah dipakai SCHEMA/DESIGN | Status 3-nilai tanpa submission |
| 8 | `proxy.ts` menggantikan `middleware.ts` | Konvensi Next 16, runtime `nodejs`; `middleware` deprecated | Tetap `middleware.ts` (edge runtime) |
| 9 | React Compiler aktif sejak awal | Memo otomatis, re-render turun, aturan memo manual gugur | Memo manual (`memo`/`useMemo`) |
