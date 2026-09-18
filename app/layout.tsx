import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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