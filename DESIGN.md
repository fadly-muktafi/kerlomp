# Kerlomp — Design System & Visual Language

> **Design Read:** Aplikasi produktivitas untuk pelajar/mahasiswa Indonesia (Gen Z), dengan bahasa visual *playful tapi rapi*, bukan dashboard korporat. Prinsip utama: "ngga mau ribet" harus terasa di setiap piksel — kontras jelas, satu aksi utama per layar, zero clutter.
> **Dials:** `DESIGN_VARIANCE: 7` · `MOTION_INTENSITY: 5` · `VISUAL_DENSITY: 5`
> **Stack visual:** Tailwind CSS v4 · `next/font` (self-host) · Phosphor Icons · Motion (`motion/react`) untuk micro-interaction.

---

## 1. Prinsip Desain (Non-Negotiable)

1. **Satu layar, satu aksi utama.** Tidak ada dua CTA primer dalam satu viewport aplikasi.
2. **Main-main boleh, ribet tidak.** Playful = warna segar, bentuk membulat berlekuk (squircle), copy santai bahasa Indonesia. Playful ≠ emoji berlebihan, animasi lama, atau banyak fitur di satu layar.
3. **Keterbacaan mengalahkan estetika.** Semua teks WCAG AA minimal (4.5:1 body, 3:1 teks besar 18px+).
4. **Mobile-first, jari-dulu.** Target sentuh minimal 44×44px. Mayoritas user buka dari HP antara kelas.
5. **Desain dalam dua mode, sekaligus.** Light & dark dari awal, kunci satu sistem token. Tidak ada bagian yang "bolak-balik tema".

---

## 2. Warna (Token Wajib)

### 2.1 Palette Inti

Satu aksen, netral sejuk-but-hangat, tanpa gradien AI-purple, tanpa putih polos/`#000`.

| Token | Light | Dark | Pakai untuk |
|---|---|---|---|
| `--bg` | `#fafaf7` (off-warm) | `#131419` (off-black) | Latar utama |
| `--surface` | `#ffffff` | `#1c1e26` | Kartu, panel, input |
| `--surface-2` | `#f1f1ec` | `#242733` | Area tenggelam / track |
| `--ink` | `#1b1d21` | `#f4f4f1` | Teks utama |
| `--ink-muted` | `#5c6068` | `#9ba0ab` | Teks sekunder (min 4.5:1) |
| `--line` | `#e3e3dc` | `#2e313d` | Garis pembatas 1px |
| **`--accent`** | `#65a30d` (lime-600, "Lime Kecut") | `#a3e635` (lime-400) | CTA, aktif, fokus — **SATU aksen, terkunci** |
| `--accent-ink` | `#1a2e05` | `#1a2e05` | Teks di atas aksen. Putih di lime-600 hanya 3.08:1 (gagal AA), jadi dipakai hijau gelap di kedua mode |
| `--ok` | `#1f9d55` | `#3fbf7f` | Status "Selesai" |
| `--warn` | `#c77400` | `#e0a33d` | Deadline dekat |
| `--danger` | `#d64545` | `#f06868` | Error / hapus |

**Rules:**
- **Satu aksen di seluruh aplikasi & landing.** Tidak ada aksen kedua untuk dekorasi. Status (ok/warn/danger) dihitung semantik, bukan dekoratif.
- Shadow tidak pernah hitam murni: memakai `oklch` tint dari `--ink`, opasitas ≤ 12%.
- Grain/noise hanya pada pseudo-element `fixed pointer-events-none`, tidak pernah pada container yang di-scroll.

### 2.2 Mode Dark
- `dark:` variant Tailwind, ditentukan di level root (`<html>`), ikuti `prefers-color-scheme` + toggle manual.
- **Theme lock:** sekali dark, semua dark. Tidak ada seksi terang di tengah dark.
- Jangan pernah `#000000` atau `#ffffff` polos.

---

## 3. Tipografi

### 3.1 Font Stack (self-host via `next/font`)

| Peran | Font | Alasan |
|---|---|---|
| Display / headline | **Space Grotesk** | Geometric, penuh karakter, playful tanpa norak, detail di heading besar |
| Body & UI | **Plus Jakarta Sans** | Kualitas super untuk bahasa Indonesia, open source, sengaja didesain untuk skrin digital, penuh nuansa lokal |
| Mono (angka timer, token invite) | **Geist Mono** | Untuk countdown, token invite, dan informasi teknis |

> **Dilarang:** Inter sebagai default, serif sebagai default, dan pencampuran serif di dalam headline sans ("italic-serif emphasis"). Emphasis dalam headline = **bold/italic font yang sama**.

### 3.2 Skala Tipe

```
display   3.5rem / 1.0  / -0.03em  (hero, desktop only)
h1        2.25rem / 1.05 / -0.02em
h2        1.75rem / 1.1  / -0.015em
h3        1.25rem / 1.2  / -0.01em
body      1rem    / 1.6   (max-width 65ch)
small     0.875rem/ 1.5
micro     0.75rem / 1.4  (uppercase tracking 0.12em, hemat: ≤ 1 per 3 seksi landing)
```

- Headline hero: maks 2 baris desktop, maks 8 kata. Subtext hero: maks 20 kata, maks 3 baris.
- Italic di display dengan descender (y,g,j,p,q): wajib `leading-[1.1]` + `pb-1`.

---

## 4. Bentuk, Jarak, Lapisan

- **Radius lock (satu sistem):** `radius-sm: 8px` (input/chip kecil) · `radius-md: 14px` (card/tombol) · `radius-full` (pill untuk status & digecet tombol kecil). **Tidak ada radius keempat.** Rule konsisten: tombol & card = 14px; input = 8px; badge status = full.
- **Grid & density:** kontainer `max-w-7xl mx-auto px-4 md:px-6`; jarak seksi aplikasi `py-8`, landing `py-24 md:py-32`. Jangan gunakan flex-math persen; selalu `grid` untuk kolom.
- **Z-index scale (tetap):** `base 0` → `sticky nav 40` → `dropdown 50` → `modal 60` → `toast 70`. Tidak ada `z-[999]`.
- **Bahaya `h-screen`:** hero dan splash pakai `min-h-[100dvh]`, tidak pernah `h-screen`.

### Bayangan

```
shadow-card:  0 1px 2px oklch(0% 0 0 / 6%), 0 4px 16px oklch(0% 0 0 / 6%)
shadow-pop:   0 2px 4px oklch(0% 0 0 / 8%), 0 12px 32px oklch(0% 0 0 / 10%)
```
Card hanya dipakai jika elevasi berarti sesuatu (sub-task, notifikasi). Pengelompokan rata-rata: `border` 1px `--line` atau jarak, bukan card di dalam card.

---

## 5. Komponen Inti (App)

Konvensi: Server Components untuk layout & fetch; Client Components dengan `"use client"` hanya untuk interaksi/motion.

### 5.1 Tombol
| Varian | Bentuk | Detail |
|---|---|---|
| Primary | `--accent` bg, `--accent-ink` text | Satu per layar, label ≤ 3 kata, satu baris |
| Secondary | `--surface` bg, `1px --line`, `--ink` text | — |
| Ghost | transparan, `--ink-muted`, hover `--surface-2` | Aksi tersier |
| Danger | `--danger` | Hanya destruktif, wajib konfirmasi |

- **Tactile feedback wajib:** `:active → scale-[0.98]` atau `-translate-y-[1px]`. Durasi 120–180ms, easing `cubic-bezier(0.16,1,0.3,1)`.
- **Kontras wajib dicek:** label vs bg ≥ 4.5:1 — tidak ada teks putih di wrana terang, tidak ada `bg-white text-white`.
- Icon dari **Phosphor** (`@phosphor-icons/react`), `strokeWidth` global 1.75. **Tidak ada ikon SVG buatan tangan.**

### 5.2 Sub-task Row
- Struktur: `[status toggle] judul • assignee avatar+name • deadline chip`.
- Update status = **1 tap** pada toggle (checklist bulat), optimistic update, lalu commit ke Realtime.
- Empty state: ilustrasi ringan + copy yang bantu ("Belum ada tugas. Pecah tugas pertamamu.").

### 5.3 Progress & Kontribusi
- Progress bar per grup: track `--surface-2`, fill `--accent`, tinggi 6px, radius full — **bar ini mempunyai makna data nyata**, jadi diizinkan track fill (aturan "no track bars" hanya untuk visual komparasi marketing).
- Kontribusi anggota: strip horizontal per anggota, tanpa dot dekoratif; nama → mini bar → `% selesai`.
- Deadline chip: `ok` normal, `warn` H-2, `danger` H-0. Jangan pakai dot berwarna di tempat lain.
- **Status chip (4 status, bentuk pill `radius-full`, label Bahasa):**
  - `todo` → "Belum" — `--surface-2` bg, `--ink-muted` text, border `1px --line`
  - `in_progress` → "Dikerjakan" — `--accent` 12% tint bg, `--accent` text (light mode `--accent`; dark tetap `--accent`)
  - `submitted` → "Menunggu Review" — `--warn` 14% tint bg, `--warn` text (beda makna dengan deadline chip meski sama warna — boleh karena satu tampilan tidak mencampur keduanya)
  - `done` → "Selesai" — `--ok` 14% tint bg, `--ok` text
  - Reject state tidak jadi status sendiri (task balik ke `in_progress`); alasan reject tampil sebagai banner `--danger` 10% tint di detail task.

### 5.4 Form
- Label **di atas** input, bukan placeholder. Placeholder = contoh saja.
- Helper teks opsional, error **di bawah** input dengan `--danger` + ikon.
- Input: `radius-sm`, border `--line`, focus ring `2px --accent`, offset 2px, kontras AA.

### 5.5 Notifikasi & Toast
- Toast hanya untuk info transien (tersimpan, terkirim). Error yang butuh tindakan = inline.
- Notifikasi in-app: bell icon + badge count, panel dropdown `radius-md`, realtime supabase channel.

### 5.6 Empty/Loading/Error (wajib, bukan pelengkap)
- Loading: **skeleton sesuai bentuk konten**, bukan spinner bulat.
- Error: inline, menyebut apa yang gagal & cara memulihkan.
- Offline: banner kecil + tombol retry; Realtime status terlihat.

---

## 6. Motion (`MOTION_INTENSITY: 5`)

- Library: **Motion** (`motion/react`), hanya di client leaf. GSAP dibukan default; dipakai hanya kalau scroll-hijack benar-benar dibutuhkan di landing.
- **Aturan:** hanya `transform` & `opacity` yang dianimasikan. Dilarang `window.addEventListener('scroll')`, rAF → setState, dan `useState` untuk nilai kontinu (pakai `useMotionValue`).
- Durasi: 150–400ms; ease standar `cubic-bezier(0.16,1,0.3,1)`; spring untukkan feedback (stiffness ~150, damping ~22).
- **Setiap animasi punya alasan** (hierarki / feedback / transisi). Gerakan cooldown = skill fail.
- Contoh motion di Kerlomp: status sub-task ber-centang → micro scale+fade; progress bar mengisi saat nilai berubah (`layout`-free, hanya width transform/scaleX); komentar baru masuk → slide-in 12px.
- **`prefers-reduced-motion` wajib didukung:** semua animasi non-esensial collapses ke instan/state.

---

## 7. Landing Page (Marketing, SEO Organik)

*Bagian ini menerapkan aturan anti-slop penuh, karena landing adalah fasad portofolio dan sumber akuisisi organik.*

1. **Hero:** split asimetris — copy kiri (rata kiri), mockup produk nyata (screenshot app sungguhan, bukan div pura-pura) di kanan. Maks 4 elemen teks: headline, subtext ≤20 kata, CTA tunggal ("Coba Gratis"), tanpa eyebrow bertumpuk. `pt-24` maks.
2. **Larangan keras (dari skill, diterapkan penuh):** zero em-dash di seluruh halaman; tidak ada 3 kartu identik sejajar; tidak ada section-number eyebrow ("01 · Fitur"); tidak ada strip teks dekoratif di bawah hero; tidak ada scroll cue; tidak ada lokasi/jam di footer; tidak ada "03 / 05"-style pagination; tidak ada dot berwarna dekoratif; marquee pakai maksimal 1× di seluruh halaman.
3. **Cara kerja:** 2 seksi pattern zig-zag maksimal; gunakan bento grid jika macamnya ≥4 fitur, dengan **jumlah sel pas** dan minimal 2 sel punya visual nyata (screenshot UI, ilustrasi rame-rame, latar bertinta). Tidak semua sel putih teks.
4. **CTA:** satu intent tunggal di seluruh page ("Coba Gratis"), dipakai ulang label yang sama di nav/hero/footer. Dilarang "Mulai Sekarang" + "Daftar Gratis" bercampur.
5. **Kopi (copy):** bahasa Indonesia santai tapi bersih; kalimat pendek; tanpa basa-basi ala AI (""revolusioner"", "tingkatkan produktivitas"). Angka spesifik hanya kalau dari data/sungguh niat. Self-audit semua string sebelum commit — baca keras: apakah terdengar seperti orang Indonesia asli?
6. **Gambar:** pakai screenshot nyata aplikasi atau generate gambar via tooling — **div-fake-screenshot dilarang keras**.
7. **SEO counterpart:** title ≤60 char, meta desc, OG image, FAQ schema untuk kata "tracker tugas kelompok", "bagi tugas kelompok online", dst. (detail di tahap v2.0).

---

## 8. Ikonografi & Ilustrasi

- Ikon: **Phosphor** only, satu family (`regular` untuk UI, `bold` untuk empty-state), `strokeWidth 1.75` seragam.
- **Dilarang:** emoji sebagai ikon UI; ikon kustom gambar tangan; campur Lucide.
- Ilustrasi: maksimal sebagai pemanis di halaman kosong, onboarding, 404 — geometris, flat, palet `--accent` + netral tanpa gradien warna-warni.

---

## 9. Accessibility Gate (harus tick sebelum PR)

- [ ] Semua teks ≥ 4.5:1 (body), ≥ 3:1 (≥18px atau bold ≥14px).
- [ ] Focus visible di semua interaktif (ring aksen, tidak dihilangkan).
- [ ] Navigasi keyboard: urutan logis, `Esc` menutup modal/dropdown, fokus terjebak di modal.
- [ ] `aria-label` untuk tombol berisi ikon saja; `aria-live` untuk notifikasi realtime.
- [ ] Target sentuh ≥ 44×44px.
- [ ] Kontras dicek di dark mode **juga**.
- [ ] Lighthouse: A11y = 100; Perf ≥ 90 (LCP < 2.5s, INP < 200ms, CLS < 0.1).
- [ ] Gambar punya alt yang bermakna; ikon dekoratif `aria-hidden`.

---

## 10. Anti-Tell Checklist (audit tiap PR visual)

- [ ] Tidak ada em-dash `—` di mana pun dalam UI/copy yang terlihat.
- [ ] Tidak ada Inter, tidak ada serif campur, tidak ada AI-purple/gradien glow.
- [ ] Tidak ada 3 kartu fitur identik dalam satu row.
- [ ] Tidak ada eyebrow nomor-seksi ("02 · Fitur kami").
- [ ] Tidak ada div-fake-screenshot / SVG-path buatan tangan.
- [ ] Tidak ada marquee kedua, splash scroll cue, atau strip dekoratif hero.
- [ ] Tidak ada dua CTA dengan intent sama berlabel beda.
- [ ] Tidak ada `#000000`, `#ffffff` polos.
- [ ] Motion ≥ 4 ⇒ halaman benar-benar bergerak, dan `prefers-reduced-motion` efektif.
- [ ] Dark mode benar di kedua mode, tanpa seksi ter-“invers” mendadak.

---

## 11. Naming Konvensi & Handoff

- Deskripsikan token hanya lewat CSS variables di atas; Tailwind utility memetakan token (via `@theme` pada Tailwind v4).
- Satu design system per proyek. Komponen kustom ditulis dari primitives sendiri (bukan shadcn default state) dan semua radius/token merujuk ke Bab 2–4.
- File keputusan desain berikutnya: perubahan apa pun pada token/bentuk/motion **wajib di-update di file ini terlebih dulu**, baru ke kode.
