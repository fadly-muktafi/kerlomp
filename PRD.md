# Kerlomp — Product Requirements Document

> **Status:** Draft v1.0
> **Owner:** Solo developer **Stack:** Next.js (App Router) · Supabase (Auth, Postgres, Realtime) · Tailwind CSS
> **North Star:** "Kelola tugas kelompok harus se-gampang bikin link — bukan nenggelemin chat di WhatsApp."

---

## 1. Executive Summary

### Problem Statement

Mahasiswa dan siswa Indonesia mengoordinasikan tugas kelompok lewat grup WhatsApp, di mana pembagian tugas tenggelam di lautan chat, tidak ada yang tahu siapa mengerjakan apa, dan deadline jarang diingat — sehingga 1–2 orang menanggung beban mayoritas di hari-H.

### Proposed Solution

Kerlomp adalah web app tracker tugas kelompok: seorang leader membuat grup, membagikan **satu link invite**, memecah tugas jadi sub-task ter-assign, dan seluruh anggota mengupdate status mereka sendiri — dengan progress bar, papan kontribusi, dan kolom komentar yang ter-update **real-time**, plus reminder deadline otomatis via in-app notification dan WhatsApp.

### Success Criteria (KPI)

| # | Metric | Target |
|---|--------|--------|
| 1 | Time-to-first-task | ≤ 60 detik dari register sampai task pertama dibuat |
| 2 | Onboarding drop-off | ≤ 20% user yang klik invite link tapi tidak jadi bergabung |
| 3 | Real-time freshness | Update status muncul di layar anggota lain dalam ≤ 2 detik (p95) |
| 4 | Reminder delivery | ≥ 95% reminder WhatsApp terkirim ≤ 5 menit dari jadwal |
| 5 | Aktivasi | ≥ 60% grup yang dibuat punya ≥ 2 anggota aktif dalam 7 hari |
| 6 | Performance & a11y | Lighthouse: Performance ≥ 90, Accessibility = 100 |

---

## 2. User Experience & Functionality

### 2.1 User Personas

- **"Si Nugas" (Leader)** — ketua kelompok, biasanya yang paling peduli nilai. Butuh kontrol: bikin grup, pecah & assign tugas, pantau kontribusi tanpa nagih lewat chat pribadi.
- **"Si Rebahan" (Member)** — anggota biasa. Anti-ribet di atas segalanya. Hanya mau: klik link → lihat tugasku → update status → kelar.
- **"Si Penonton" (Passive Member)** — jarang update sendiri, tapi perlu lihat progress kelompok dan dapat reminder biar nggak jadi beban.

### 2.2 User Stories & Acceptance Criteria

#### Epic A — Auth & Onboarding

**A1.** Sebagai user, saya bisa login hanya dengan satu klik Google, tanpa form pendaftaran, supaya saya tidak perlu mengingat password lagi.
- ✅ Google OAuth (Supabase Auth) adalah satu-satunya metode login; tidak ada email+password.
- ✅ Setelah OAuth pertama, profil otomatis dibuat dengan nama & avatar dari akun Google; user hanya diminta konfirmasi 1 layar (boleh edit nama tampilan).
- ✅ Session persisten minimal 30 hari (refresh token berjalan).

**A2.** Sebagai anggota baru, saya bisa bergabung ke grup hanya dengan mengklik link dan memasukkan nama — tanpa login — supaya bergabung semudah mungkin.
- ✅ Invite link berbentuk `/join/[token]` → satu input nama → user langsung tercatat sebagai **guest member** dan dapat membuka board grup (read-only). Identitas guest diikat ke cookie sesi berumur 30 hari (HTTP-only).
- ✅ Guest member terepresentasi sebagai baris `members` dengan `user_id IS NULL` (belum ter-link ke akun).
- ✅ Link bisa di-revoke dan di-regenerate oleh leader.
- ✅ Join via token invalid/revoked menampilkan halaman error yang jelas (bukan crash).

**A3.** Sebagai guest member, ketika saya ingin menggunakan fitur (update status, komentar, dll.), saya diarahkan login Google dan identitas guest saya otomatis menjadi akun sungguhan supaya assignment task saya tidak hilang.
- ✅ Setiap aksi interaktif (ubah status, tulis komentar, edit) yang dilakukan guest memicu prompt login Google.
- ✅ Setelah OAuth sukses, sistem menjalankan **claim flow**: `members.user_id` diisi dengan id akun, dan semua sub-task yang sebelumnya ter-assign ke guest tetap ter-assign ke user yang sama.
- ✅ Session guest di browser lain tidak ikut ter-claim (claim hanya berlaku lewat cookie sesi yang aktif).
- ✅ Jika akun Google merupakan anggota **lain** di grup yang sama, claim ditolak dengan pesan jelas (mencegah impersonasi).

#### Epic B — Manajemen Grup & Tugas

**B1.** Sebagai leader, saya bisa membuat grup tugas beserta judul, deskripsi, dan deadline global.
- ✅ CRUD grup; hanya leader yang bisa edit/hapus grup.
- ✅ Maksimal 1 input wajib (nama grup) — sisanya opsional.

**B2.** Sebagai leader, saya bisa memecah tugas besar menjadi sub-task dan meng-assign masing-masing ke anggota.
- ✅ Sub-task punya: judul (wajib), deskripsi, assignee, dan opsional deadline sendiri.
- ✅ Re-assign dan hapus sub-task hanya bisa dilakukan leader; assignee bisa menolak serah-flokir (tidak bisa ubah assignee sendiri).

**B3.** Sebagai anggota, saya bisa melihat daftar "Tugasku" di semua grup dalam satu view.
- ✅ Dashboard personal menampilkan sub-task milik user lintas grup, terurut berdasarkan deadline.

#### Epic C — Progress & Real-time

**C1.** Sebagai anggota, saya bisa mengupdate status sub-task saya sendiri (Belum → Dikerjakan → Selesai) dalam ≤ 2 klik.
- ✅ Tombol status satu tap; perubahan tersimpan ≤ 500ms.

**C2.** Sebagai anggota, saya bisa melihat progress bar grup dan kontribusi tiap anggota yang update sendiri tanpa refresh.
- ✅ Perubahan status apa pun muncul di semua client ≤ 2 detik (p95) via Supabase Realtime subscription pada tabel `sub_tasks` & `members`.
- ✅ Indikator kontribusi per anggota: jumlah sub-task selesai / total assigned, ditampilkan sebagai bar per anggota.

**C3.** Sebagai user, saat koneksi putus, saya diberi indikator "offline" yang jelas dan UI tidak berubah diam-diam saat reconnect.
- ✅ Status koneksi Realtime ditampilkan; saat reconnect, data di-refetch penuh.

#### Epic D — Kolaborasi

**D1.** Sebagai anggota, saya bisa berkomentar di tiap sub-task agar diskusi tidak hilang di chat.
- ✅ Komentar per sub-task, real-time, dengan nama & avatar penulis.
- ✅ MVP: teks saja, tanpa attachment/nesting (reply).

#### Epic E — Reminder Deadline

**E1.** Sebagai anggota, saya mendapat notifikasi in-app saat deadline mendekat (H-1 dan H-0).
- ✅ Notifikasi in-app (bell icon + badge, real-time).

**E2.** Sebagai anggota, saya mendapat reminder via WhatsApp agar tetap ingat walau tidak buka app.
- ✅ User opt-in: memasukkan nomor WA di pengaturan dan menyetujui reminder.
- ✅ Reminder terkirim H-1 (18:00) dan H-0 (08:00) untuk task dengan status ≠ Selesai.
- ✅ Delivery rate ≥ 95%; gagal kirim dicatat ke log dan bisa dilihat di panel debug (dev-only).

### 2.3 Non-Goals (dilindungi dari scope creep)

- ❌ Kanban drag-and-drop antar-kolom (status pakai 1 tombol, bukan board).
- ❌ File upload / attachment.
- ❌ Chat global per grup (hanya komentar per sub-task).
- ❌ Integrasi LMS/aplikasi kampus.
- ❌ Notifikasi push native (mobile app tidak dibuat).
- ❌ Multi-leader/admin role (satu grup = satu leader).

---

## 3. AI System Requirements

Tidak ada fitur AI pada MVP maupun roadmap yang direncanakan saat ini. (Kandidat masa depan, di luar scope PRD ini: auto-splitting tugas jadi sub-task via LLM.)

---

## 4. Technical Specifications

### 4.1 Architecture Overview

```
[Browser: Next.js App Router + Tailwind]
        │  Server Components (data awal) + Client Components (interaktif)
        ▼
[Supabase]
 ├─ Auth (Google OAuth, PKCE)
 ├─ Postgres + Row Level Security (RLS)
 ├─ Realtime (postgres_changes: sub_tasks, comments, members, notifications)
 └─ Scheduled Edge Function (Supabase Cron) → reminder queue
                                                  │
                                                  ▼
                                  [WA Layer: Meta Cloud API jika gratis,
                                   fallback: OpenWA self-hosted] → WhatsApp user
```

- **Data awal** dimuat via Server Components (tidak ada spinner layar penuh).
- **Update** mengalir via Realtime: client subscribe ke channel per-grup; payload postgres_changes di-merge ke state lokal (optimistic update dari actor lokal diakui dulu).
- **Reminder**: Supabase Cron (tiap 15 menit) memanggil Edge Function yang memindai deadline jatuh tempo H-1/H-0, menulis baris ke tabel `notifications` (in-app), dan memanggil API gateway WhatsApp untuk nomor yang opt-in.

### 4.2 Data Model (rancangan awal — detail kolom di `SCHEMA.md`)

| Tabel | Peran |
|---|---|
| `profiles` | id (FK auth.users), display_name, avatar_url, wa_number, wa_opt_in |
| `groups` | id, name, description, deadline, leader_id, invite_token, created_at |
| `members` | group_id, user_id (nullable), guest_name, guest_token, joined_at (PK komposit) |
| `sub_tasks` | id, group_id, title, description, assignee_id, status (`todo`/`in_progress`/`done`), deadline |
| `comments` | id, sub_task_id, author_id, body, created_at |
| `notifications` | id, user_id, type, payload, read_at, created_at |

### 4.3 Integration Points

| Layanan | Tujuan | Catatan |
|---|---|---|
| **Google OAuth** via Supabase Auth | Satu-satunya metode login | PKCE flow; scope minimal (`openid email profile`) |
| **Supabase Postgres + RLS** | Database & otorisasi | RLS ketat di bawah |
| **Supabase Realtime** | Sinkronisasi status/komentar/notifikasi | Channel per `group_id` + per user untuk notifikasi |
| **Supabase Cron + Edge Functions** | Penjadwal reminder | Intervals 15 menit |
| **Meta WhatsApp Cloud API** *(pilihan utama)* | Reminder WhatsApp | Resmi & stabil; dipakai **jika tier gratis mencukupi** volume reminder; dikenakan env secret |
| **OpenWA** *(fallback)* | Reminder WhatsApp | Library OSS (`open-wa/wa-automate-node`) self-hosted via sesi WhatsApp nomor milik kita; dipakai kalau Cloud API berbayar. Harus anti-ban: pacing pesan (jeda acak 3–8 detik), maks 2 reminder/user/hari, auto-pause jika terdeteksi anomali |

### 4.4 Security & Privacy

- **RLS (wajib, bukan opsional):**
  - User hanya bisa membaca grup di mana ia tercatat di `members` — entah sebagai akun login, atau sebagai guest via Edge Function read-only keyed pada `guest_token` cookie (guest tidak pernah mendapat role `authenticated` Supabase).
  - Hanya `assignee` **yang sudah login** yang bisa mengubah `sub_tasks.status`; guest hanya read; hanya `leader` yang bisa mengubah assignee/judul/hapus.
  - Claim flow berjalan dalam Edge Function transaksional: verifikasi cookie guest → set `user_id` → kalau `user_id` target sudah ada di `members` grup itu, abort.
  - Komentar: siapa pun di grup bisa baca; hanya penulis yang bisa hapus; insert dibatasi `author_id = auth.uid()`.
  - Join via invite: Edge Function ber-verify token lalu insert ke `members` (client tidak menulis `members` langsung).
- **Privasi:** nomor WA disimpan terenkripsi at-rest (Postgres pgcrypto / kolom rahasia), tidak pernah diekspos ke anggota lain; opt-in eksplisit + tombol opt-out satu klik.
- **Compliance:** untargeted belum perlu regulasi berat, tapi nomor telepon = PII → kebijakan retensi dan penghapusan akun (cascade delete) wajib ada sebelum rilis publik.

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout

| Fase | Isi | Gate kualitas |
|---|---|---|
| **MVP** | Auth Google, grup + invite link, sub-task CRUD + assign, update status 1-tap, progress bar + kontribusi (Realtime), RLS lengkap | KPI #1, #3, #6 tercapai di dev build |
| **v1.1** | Komentar real-time, dashboard "Tugasku", notifikasi in-app H-1/H-0 | Coverage test RLS ≥ 80% tabel kritikal |
| **v1.2** | Reminder WhatsApp (Cloud API *atau* OpenWA sesuai hasil uji biaya), opt-in/out nomor WA, log delivery | KPI #4; uji failure (gateway down/ban → retry + fallback in-app saja) |
| **v2.0** | Audit UI/UX, polish performa, halaman publik/SEO untuk akuisisi organik, case study portofolio | KPI #2, #5 diukur dari pengguna nyata |

### 5.2 Technical Risks

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Cloud API jadi berbayar / OpenWA diban** | Reminder WA mati | Abstraksi WA di balik satu interface (`WASender`) → swap provider tanpa ubah kode; fallback in-app notification; flag di log |
| **Gratis tier Supabase habis** (rows Realtime / DB) | App mati mendadak | Alert usage ≥ 80%; arsipkan grup lama (soft-archive) |
| **RLS mis-configuration** | Kebocoran data antargrup (fatal bagi portofolio) | Tabel RLS + test integration otomatis sebelum merge; tidak pernah pakai service-role di client |
| **OAuth callback / cookie domain bug saat deploy** | Semua user gagal login | Checklist deploy: redirect URLs, Site URL, env parity lokal↔prod |
| **Lost guest session** (cookie hilang/incognito) | Guest kehilangan identitas; nama duplikat muncul | Leader bisa merge manual dua record anggota; UI mengingatkan guest untuk login Google |
| **Biaya WA tumbuh dengan user** | Biaya bulanan tak terduga | Rate-limit reminder per user/hari (maks 2); awalnya WA reminder hanya untuk deadline global grup |
| **Solo dev burn-out → scope creep** | Proyek mandek | Non-Goals bersifat final; fitur baru wajib masuk backlog, bukan fase aktif |

---

## 6. Open Questions (TBD)

1. Batas ukuran grup & jumlah sub-task (anti-abuse + batas free tier). Proposal awal: 20 anggota/grup, 100 sub-task/grup.
2. ~~WA gateway mana yang dipakai~~ → **Diputuskan**: Meta Cloud API jika gratis; OpenWA self-hosted (anti-ban, throttle) jika tidak. Yang tersisa: uji coba aktual volume reminder vs limit gratis Cloud API.
3. Apakah WhatsApp reminder butuh balasan interaktif ("ketik DONE untuk selesai")? — sengaja ditunda ke v2.x.

---

*Ditolak secara final: tidak menambah media sosial, leaderboard XP/gamifikasi, atau fitur di luar daftar roadmap tanpa meng-update dokumen ini.*
