# Kerlomp - Checklist Tes Manual

> Cara pakai: jalankan `pnpm dev`, lalu telusuri tiap bagian. Setiap fase yang selesai
> menambah satu bagian baru di sini. Tandai `[x]` kalau hasilnya sesuai.
>
> Tips:
> - Pakai dua jendela: A = login Google, B = private/incognito (belum login).
> - Pilih satu origin dan pakai konsisten: `http://127.0.0.1:3000` ATAU `http://localhost:3000`.
>   Allowlist redirect Supabase harus memuat origin tersebut.
> - Di balik proxy kantor, `pnpm dev` sudah menyetel `NODE_USE_ENV_PROXY=1` agar Node fetch
>   server ke Supabase ikut proxy.

---

## Fase 3a - Auth & fondasi

- [x] `pnpm dev` jalan tanpa warning font Google Fonts.
- [x] Landing `/` tampil; CTA "Coba Gratis" terlihat.
- [x] Font self-host aktif: DevTools > Elements, variabel `--font-plus-jakarta` di `<html>` terisi;
      Network tidak memuat `gstatic`, file woff2 datang dari `/_next/static/media`.
- [x] Dark mode mengikuti preferensi OS. (Toggle manual belum dipasang di UI.)
- [x] Login Google dari `/login` berhasil, mendarat di `/dashboard`, muncul "Halo, <nama>".
- [x] Guard: buka `/dashboard` saat belum login -> redirect ke `/login`.
- [x] Tombol "Keluar" -> balik ke `/login`.
- [x] Tidak ada error 500 atau 42501 di console browser maupun terminal server.

## Fase 3b - Grup, invite, guest, claim

- [x] Window A: buat grup dari dashboard -> redirect `/g/<id>`, tampil sebagai Leader, panel
      "Undang anggota" muncul.
- [x] Salin link `/join/<token>`, buka di window B.
- [x] Window B: form gabung, isi nama -> redirect `/g/<id>`; badge Tamu, CTA "Masuk pakai Google",
      panel invite TIDAK muncul, daftar anggota memuat "<nama> (tamu)".
- [x] Window A: refresh `/g/<id>` -> jumlah anggota bertambah. (Belum realtime, refresh dulu.)
- [x] "Buat ulang link" di window A -> link lama di window B jadi "Link tidak berlaku";
      link baru bisa dipakai.
- [x] Claim: window B klik "Masuk pakai Google" lalu login akun lain -> balik ke `/g/<id>`,
      identitas tamu berubah jadi akun, badge Tamu dan CTA hilang.
- [x] Isolasi: akun ketiga membuka `/g/<id-grup-bukan-miliknya>` -> 404.

Catatan: "Buat ulang link" = revoke efektif (token lama mati). Belum ada penonaktifan undangan tanpa generate ulang.

## Fase 3c - Sub-task, status, realtime

- [x] Window A (leader): di `/g/<id>` muncul "Tugas (0)", progress 0%, form "Tambah tugas".
- [x] Tambah tugas (judul + pilih anggota + deadline opsional) -> tugas muncul di daftar,
      chip status "Belum", deadine chip muncul sesuai waktu.
- [x] Progress bar dan strip kontribusi terisi begitu ada tugas selesai.
- [x] Window A: tap bulatan status pada tugas yang di-assign ke kamu -> status jadi
      "Dikerjakan" (optimistic, langsung berubah).
- [x] Realtime: buka `/g/<id>` yang sama di window B (login anggota yang sama) -> ubah status
      di window A, window B ikut berubah dalam <= 2 detik tanpa refresh. Indikator "Tersambung"
      tampil saat channel aktif.
- [x] Reassign: pilih anggota lain di dropdown tugas -> assignee berubah dan kontribusi menyesuaikan.
- [x] Hapus: tombol hapus -> "Hapus"/"Batal" -> tugas hilang.
- [x] Guest (window private): board terlihat read-only, tanpa tombol status/form, tanpa panel invite.

Catatan: status "Selesai" baru tercapai lewat submit bukti (3d). Di 3c toggle hanya Belum <-> Dikerjakan.

## Fase 3d - Bukti & approval

- [x] Assignee: buka detail tugas (klik judul tugas) saat status "Dikerjakan" -> form "Serahkan
      bukti" muncul.
- [x] Isi bukti teks (min 10 karakter) + unggah 1-3 file (jpeg/png/webp/pdf/docx/pptx, <=10MB)
      -> "Serahkan bukti" -> status jadi "Menunggu Review".
- [x] File di atas 10MB atau tipe tidak diizinkan ditolak dengan pesan jelas.
- [x] Leader: buka detail tugas yang "Menunggu Review" -> lihat catatan + tautan file (bisa diunduh
      lewat signed URL), lalu "Setujui" -> status "Selesai".
- [x] Leader: "Tolak" tanpa alasan ditolak; dengan alasan -> tugas balik "Dikerjakan" dan banner
      alasan tampil.
- [x] Guest membuka detail tugas -> read-only (tanpa form bukti/review), ada CTA "Masuk pakai Google".

Catatan: file bukti tersimpan privat di bucket `proofs`; dibaca hanya lewat signed URL berumur 1 jam.

## v1.1a - Komentar real-time

- [x] Detail tugas punya seksi "Diskusi": daftar komentar dengan nama penulis (dan "(tamu)" bila guest).
- [x] Member: form "Tambah komentar" tampil; kirim komentar (maks 2000) -> komentar langsung muncul
      (optimistic) dan tersimpan (refresh tetap ada).
- [x] Realtime: dua jendela login anggota sama, buka detail tugas yang sama -> komentar yang dikirim
      jendela A muncul di jendela B dalam <= 2 detik tanpa refresh.
- [x] Realtime hapus: komentar yang dihapus hilang di jendela lain tanpa refresh.
- [x] Realtime guest: guest (tanpa login) melihat komentar muncul dan hilang secara realtime,
      lewat sinyal broadcast dari member yang beraksi + refetch via API.
- [x] Hapus komentar milik sendiri (dan leader bisa hapus komentar siapa pun) -> hilang realtime.
- [x] Guest: seksi Diskusi read-only, tanpa form; komentar tetap terbaca.
- [x] Komentar kosong ditolak dengan pesan; komentar bukan anggota grup ditolak.

Catatan arsitektur realtime:
- Member = postgres_changes (butuh JWT; token sesi dipasang SEBELUM join channel, kalau tidak
  channel masuk sebagai anon dan event tidak pernah dikirim).
- Event DELETE/UPDATE butuh `REPLICA IDENTITY FULL` (migrasi 0007).
- Guest = sinyal broadcast "data changed" dari member yang beraksi (via channel yang sama),
  lalu refetch via `/api/comments` (migrasi 0008/0009). Perubahan dari sumber non-klien
  (mis. admin/cron) tidak memicu sinyal untuk guest.

## Fase 3e - Verifikasi akhir

**Otomatis (sudah dijalankan)**
- [x] `pnpm lint` (eslint + tsc) hijau.
- [x] `pnpm test` (vitest) hijau: merge realtime, validasi zod, format.
- [x] `pnpm build` hijau.
- [x] `pnpm test:e2e` 10 test hijau, termasuk guest flow ber-seed (join -> board read-only ->
      detail read-only), token undangan invalid, sign-upload tanpa sesi ditolak, dan a11y axe
      (landing + login) tanpa pelanggaran serius. Test ber-seed butuh `SUPABASE_SERVICE_ROLE_KEY`
      di `.env.local`; data seed dibersihkan otomatis setelah test.
- [x] Advisor Supabase: sisa 2 WARN yang memang by design (RPC resmi callable oleh `authenticated`).

**Manual (perlu dijalankan manusia)**
- [x] Lighthouse di `/`, `/login`, dan `/g/<id>` (guest): Performance >= 90, Accessibility = 100.
      Bisa lewat Chrome DevTools > Lighthouse, atau:
      `npx lighthouse http://127.0.0.1:3000 --only-categories=performance,accessibility --view`
- [x] Navigasi keyboard: Tab melewati header -> form -> tombol; focus ring aksen terlihat.
- [x] Kontras dark mode: tombol aksen (teks hijau gelap di lime-400) tetap terbaca.
- [x] Uji koneksi Realtime: matikan jaringan sebentar -> indikator berubah "Offline", lalu
      "Tersambung" lagi tanpa reload dan data ter-refetch.
- [x] Catatan Auth: "Leaked Password Protection" sengaja belum diaktifkan karena login hanya
      Google OAuth (tanpa password). Aktifkan bila nanti menambah login password.

Catatan: a11y otomatis memakai axe (WCAG 2.0/2.1 A+AA, level serious/critical). Lighthouse
menambah audit performa dan skor aksesibilitas penuh.