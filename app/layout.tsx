import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Font di-self-host via next/font/local (DESIGN.md §3.1).
 * Alasan: dev/build tidak boleh bergantung jaringan/proxy ke fonts.googleapis.com.
 * Semua variable font, subset latin (cukup untuk Bahasa Indonesia).
 */
const sans = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-plus-jakarta",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const display = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const mono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "Kerlomp - Tracker tugas kelompok anti ribet",
    template: "%s | Kerlomp",
  },
  description:
    "Bikin grup, bagikan link, pecah tugas, dan pantau progres kelompokmu real-time. Tanpa grup WhatsApp yang berantakan.",
};

/**
 * Script sinkron sebelum paint: set `.dark` dari localStorage / prefers-color-scheme.
 * Mencegah flicker mode terang sesaat (rendering-hydration-no-flicker).
 */
const THEME_SCRIPT =
  '(function(){try{var t=localStorage.getItem("kerlomp-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(t!=="light"&&d)){document.documentElement.classList.add("dark")}}catch(e){}})();';

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}