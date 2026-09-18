export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col items-start justify-center gap-6 px-4 pt-24 md:px-6">
      <h1 className="font-display max-w-2xl text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl">
        Tugas kelompok rapi, tanpa scroll WhatsApp.
      </h1>
      <p className="max-w-[65ch] text-base leading-relaxed text-ink-muted">
        Bikin grup, bagikan satu link, pecah tugas, dan pantau progres semua
        anggota secara real-time.
      </p>
      <a
        href="/login"
        className="inline-flex h-11 items-center rounded-md bg-accent px-6 font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98]"
      >
        Coba Gratis
      </a>
    </main>
  );
}
