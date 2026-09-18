# Kerlomp — Engineering Rules (RULES.md)

> Berlaku untuk: manusia maupun agent AI yang menulis kode di repo ini.
> Dokumen kebenaran berjenjang: **PRD.md** (apa & kenapa) → **DESIGN.md** (bagaimana terlihat) → **ARCHITECTURE.md** (bagaimana terhubung) → **SCHEMA.md** (data & security) → **file ini** (bagaimana menulis kodenya).
> Jika konflik: dokumen hierarchy di atas menang. Jika dokumen ini berubah, perubahan performa-rules mengacu ke *vercel-react-best-practices* skill.

---

## 0. Quick Start

```bash
pnpm dev          # Next.js dev
pnpm lint         # eslint + tsc --noEmit (wajib hijau sebelum commit)
pnpm test         # vitest (unit + RLS logic)
pnpm test:e2e     # playwright (kritis flows)
```

> Di balik proxy kantor, `pnpm dev` menjalankan `cross-env NODE_USE_ENV_PROXY=1` agar Node fetch server (ke Supabase) ikut proxy. Di jaringan normal flag ini tidak berdampak.

TypeScript **strict**. Tidak ada `any` tanpa komentar `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- alasan: ...`.

---

## 1. Aturan Emas (pelanggaran = PR ditolak)

1. **`service_role` key tidak pernah menyentuh client.** Cek visual: file di `components/`, `app/` page (client), atau `lib/` yang diimport client tidak boleh mengimport dari `lib/supabase/admin.ts`.
2. **Semua write sensitif dan transisi bisnis lewat RPC** (`submit_proof`, `review_submission`), bukan `update()` tabel langsung dari client, sesuai SCHEMA.md §6.
3. **RLS test wajib ikut berubah** setiap ada policy baru / berubah (10 test gate di SCHEMA.md §10 berlaku).
4. **Tidak ada em-dash** `—` di string yang terlihat user, komentar desain, atau copy. Sesuai DESIGN.md.
5. **Tidak ada secret di repo.** `.env*` di-ignore; pakai `zod` untuk memvalidasi env di boot (server-side only).
6. **Satu design system:** token DESIGN.md via Tailwind/@theme. Tidak ada hex literal di JSX.
7. **Realtime behavior didefinisikan di `components/realtime/realtime-provider.tsx`** — tidak ada channel ad-hoc di komponen lain.

---

## 2. Struktur Kode & Naming

- **Server Components default.** Tambah `"use client"` hanya kalau perlu (interaksi, hook state, motion, realtime). Pertanyaan wajib saat review: "kenapa ini client?"
- **Colocation:** komponen fitur di `components/features/<nama>/`; primitives di `components/ui/`. Satu komponen utama per file.
- **Naming:**
  - file & folder: `kebab-case` (`task-thread.tsx`)
  - komponen/types: `PascalCase`, fungsi/variabel: `camelCase`, konstanta true-global: `SCREAMING_SNAKE_CASE`
  - boolean: `is`, `has`, `can`, `should` (e.g., `isSubmittedVisible`)
- **Path alias:** pakai `@/` (bukan relative `../../../../`).
- **Bahasa:** kode & komentar dalam Bahasa Indonesia atau Inggris konsisten satu file — jangan campur di kalimat yang sama. Copy yang tampil ke user: Bahasa Indonesia santai (DESIGN.md §7.5).

---

## 3. Data Fetching & Async (Skill: `async-*` — CRITICAL)

> Detail lengkap tiap aturan: `skills/vercel-react-best-practices/rules/`. Yang wajib diingat:

- **`async-parallel`** — fetch independen wajib `Promise.all`. Board grup **tidak boleh** chains grup → sub_tasks → members sequential. Reka ulang: satu RPC join atau paralel Promise.
- **`async-cheap-condition-before-await`** — evaluasi kondisi sinkron yang murah lebih dulu; jangan `await` flag/remote bila gabungan kondisinya sudah pasti gagal.
- **`server-no-shared-module-state`** — jangan simpan data per-request (user, grup) di variabel module-level; server render berjalan konkuren dan bisa bocor antar-request. Turunkan lewat props/return.
- **`async-suspense-boundaries`** — bungkus section berat (misal panel komentar, leaderboard kontribusi) dalam `<Suspense>`; jangan blokir seluruh halaman.
- **`async-defer-await`** — pindahkan await ke cabang yang benar-benar memakainya; jangan await "just in case".
- **`server-parallel-fetching`** — strukturkan komponen agar fetch paralel by-design (leaf fetch sendiri), bukan parent fetch semua.
- **`server-auth-actions`** — setiap Server Action wajib cek auth di dalam action (jangan andalkan layout protection).
- **`server-cache-react`** — pakai `React.cache()` untuk dedup per-request (misal `getCurrentUser()` dipanggil beberapa komponen).
- **`server-serialization`** — hanya kirim field yang dipakai ke client component; dilarang kirim row mentah DB kalau cuma butuh 3 kolom (cek RLS + PII sekaligus).
- **`server-after-nonblocking`** — side-effect tidak-kritis (log event, kirim notif in-app lewat DB) pakai `after()` agar respons tidak menunggu.

## 4. Bundle (Skill: `bundle-*` — CRITICAL)

- **No barrel imports** (`index.ts` re-export massal) — import langsung ke file. Ini alasan `components/ui/` dipilah per-file.
- **`bundle-dynamic-imports`** — komponen berat di-bawah-the-fold (e.g., picker file bukti, wizard pembuat grup) di-`next/dynamic`.
- **`bundle-defer-third-party`** — analytics/logging dimuat setelah hydration.
- **Bundle-conscious icons:** `@phosphor-icons/react` tree-shakable; pastikan tidak mengimpor seluruh library via wildcard; set `optimizePackageImports` di `next.config.ts`.
- **`bundle-analyzable-paths`** — import dinamis dan path file harus literal atau lewat peta eksplisit, bukan dirakit dari variabel, agar bundler tidak melebarkan trace.

## 5. Client Side & Realtime (Skill: `client-*`, `rerender-*`)

- **`client-swr-dedup`** — kalau ada fetch client-side (jarang, prefer RSC), pakai SWR/React Query dengan dedup & fingerprint stabil.
- **`rerender-move-effect-to-event`** — logic user-interaction masuk ke event handler, bukan effect.
- **`rerender-derived-state-no-effect`** — turunan nilai (misal: `isAllDone = tasks.every(...)`) di-render, jangan di-`useEffect`-kan.
- **`rerender-functional-setstate`** / **`advanced-use-latest`** / **`useEffectEvent`** — callback yang dipassing ke subscriber realtime harus stabil. React 19.2 menyediakan `useEffectEvent`; jangan masukkan fungsi itu ke dependency array, cukup nilai reaktifnya.
- **`rerender-no-inline-components`** — dilarang mendefinisikan komponen di dalam komponen.
- **`rendering-content-visibility`** — daftar subtask > 50 item: pakai `content-visibility: auto` (atau virtualisasi nanti bila benar-benar panjang).
- **`rendering-conditional-render`** — pakai ternary, bukan `{x && <Thing/>}` untuk conditional yang bisa undefined.

### Realtime spesifik Kerlomp
- Satu subscription per (user, grup) di provider; komponen konsumsi via context/query cache lokal — **tidak ada subscribe di komponen**.
- Optimistic update pada status sub-task; ketika event realtime datang, bandingkan `updated_at` watermark sebelum apply.
- Reconnect: pada `SUBSCRIBED` ulang, refetch snapshot watermark-check. Tidak pernah `window.location.reload()` untuk "sync".

## 6. Motion & Visual (sesuai DESIGN.md §6)

- Animasi hanya **`transform` + `opacity`**. Dilarang animasi layout property.
- Library: `motion/react` saja untuk app; GSAP hanya kalau landing membutuhkan scroll hijack, dan hanya di komponen terisolasi dengan cleanup.
- `useReducedMotion` wajib di semua motion component; reduced-motion collapse ke instant state.
- Semua motion leaf component = `"use client"` murni; parent yang ber-SSR tetap server.

## 7. Form & Aksi User

- Label di atas input, error inline di bawah (DESIGN.md §5.4). Tidak ada placeholder-as-label.
- Server action form pakai `useFormStatus`/`useTransition` untuk loading — tombol jangan double-submit.
- Validasi: client untuk UX (instan), server (RPC/route handler) untuk kebenaran — **dua-duanya**, bukan salah satu.
- File upload bukti: alur signed-URL sesuai SCHEMA.md §7; tidak ada upload langsung ke Storage dari client dengan anon key.

## 8. Database & Supabase

- Migrasi DDL hanya dari `supabase/migrations/`; edit SCHEMA.md dulu, lalu generate migrasi. **Dilarang edit DB via dashboard langsung di production.**
- Project ini memakai **imperative migrations** (bukan declarative `supabase/schemas/`). Iterasi schema pakai `execute_sql` (MCP) atau `supabase db query` lokal; saat siap commit, pakai `supabase db pull <nama> --local --yes` lalu verifikasi `supabase migration list --local`. **Jangan** pakai `apply_migration` untuk DB lokal.
- Sebelum implementasi fitur Supabase, cek `https://supabase.com/changelog.md` untuk tag `breaking-change`, lalu rujuk docs lewat MCP `search_docs` atau halaman `.md`. Saat debugging error Supabase, baca dulu docs Monitoring & Debugging Supabase.
- Jalankan `supabase db advisors` (CLI v2.81.3+) atau MCP `get_advisors` setelah perubahan schema, dan wajib bersih sebelum merge.
- Query selalu `select` eksplisit kolom (lihat §3 serialization). Tidak ada `select('*')` di kode produk.
- Semua fungsi SQL `security definer` wajib `set search_path = ''` + nama objek ter-fully-qualified (`public.members`, dst). Jangan pakai `search_path = public`: itu membuka celah function hijack. Helper RLS tinggal di schema `private`, di-revoke dari `public`/`anon`/`service_role`, tetapi WAJIB di-`grant execute` ke `authenticated` karena policy dievaluasi sebagai role pemanggil. Kalau tidak, query user login error 42501 (SCHEMA.md §4).
- Index baru → catat di SCHEMA.md §9.

## 9. Testing Gate (wajib sebelum merge)

| Lapisan | Minimum |
|---|---|
| Lint & type | `pnpm lint` hijau |
| Unit (vitest) | merge realtime, status-transition guards, util deadline |
| RLS (SCHEMA §10) | 10 skenario kunci, semua pass |
| E2E kritis (Playwright) | create group → join guest → login claim → submit proof → leader approve/reject → realtime terlihat di tab kedua ≤ 2s |
| Visual/a11y | Lighthouse: Perf ≥ 90, A11y = 100 — jalankan di halaman baru/berubah |

Setiap fase selesai: perbarui `MANUAL-TEST.md` (checklist langkah + hasil yang diharapkan) agar bisa diuji mandiri.

Tidak ada commit langsung ke `main`. Semua lewat PR.

## 10. Git & PR

- Branch: `feat/<topik>`, `fix/<topik>`, `chore/<topik>`.
- Commit conventional: `feat:`, `fix:`, `chore:`, `docs:`, `perf:`, `refactor:` — pesan Bahasa Indonesia/Inggris jelas, satu ide per commit.
- PR body: tujuan + screenshot (bila visual) + checklist dari §9 dicontreng.
- Merge: squash, judul PR = deskripsi deliverable.

## 11. AI-Assisted Coding (aturan khusus untuk agent)

1. **Baca dokumen ini + PRD/DESIGN/ARCH/SCHEMA sebelum ngoding.** Jangan mengarang requirement.
2. **Full output enforcement:** tidak bikin `// TODO: implement later` atau potongan setengah tanpa komentar `// TODO(agent): ...` + deskripsi persis apa yang kurang + kenapa.
3. Tidak mengubah `package.json` tanpa alasan tertulis di commit message (deps minimal, sesuai ARCHITECTURE.md §2).
4. Jika menyimpang dari skill rules (misal perlu `&&` conditional karena kasus khusus), tambahkan komentar `// rule-override: <id-rule> — alasan`.
5. Copy user-facing = Bahasa Indonesia, ikut DESIGN.md §7.5, nol em-dash.

---

## Lampiran A — Peta Rule yang Diadopsi

| Kategori (prio) | Rule ID (skill) | Penerapan kunci di Kerlomp |
|---|---|---|
| Async (KRITIS) | `async-parallel`, `async-suspense-boundaries`, `async-defer-await` | Board grup, dashboard, detail task |
| Bundle (KRITIS) | `bundle-barrel-imports`, `bundle-dynamic-imports`, `bundle-defer-third-party` | Import per-file; dynamic wizard/upload; analytics pasca-hydration |
| Server (TINGGI) | `server-auth-actions`, `server-cache-react`, `server-serialization`, `server-parallel-fetching`, `server-after-nonblocking` | Semua Server Action + RSC fetch |
| Client (TINGGI-MENENGAH) | `client-swr-dedup`, `client-event-listeners`, `client-passive-event-listeners` | Realtime provider, list scroll |
| Re-render (MENENGAH) | `rerender-derived-state-no-effect`, `rerender-functional-setstate`, `rerender-no-inline-components`, `rerender-move-effect-to-event`, `advanced-use-latest` | Form, filter, subscriber |
| Rendering (MENENGAH) | `rendering-content-visibility`, `rendering-conditional-render`, `rendering-hydration-suppress-warning` | List panjang, conditional UI |
| JS (MENENGAH-RENDAH) | `js-index-maps`, `js-combine-iterations`, `js-early-exit`, `js-tosorted-immutable`, `js-flatmap-filter` | Data processing kontribusi, watermark |
| Advanced (RENDAH) | `advanced-init-once`, `advanced-use-latest` | Provider boot, callback stabil |

> Detail & contoh tiap rule: folder `rules/` di skill *vercel-react-best-practices*. Saat implementasi, kutip `rule-id` di komentar untuk jejak audit.

*Perubahan pada file ini lewat PR berlabel `rules` dengan alasan eksplisit.*
