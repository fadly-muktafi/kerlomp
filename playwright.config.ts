import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Muat .env.local agar worker e2e bisa memakai Supabase admin (seeding).
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    // Buang komentar inline (mis. `WA_PROVIDER=   # meta | openwa`) lalu kutip.
    process.env[key] = raw
      .replace(/\s+#.*$/, "")
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const LOCAL_HOST = "127.0.0.1";
const LOCAL_BYPASS = `${LOCAL_HOST},localhost`;

/**
 * Proxy jaringan kantor (HTTP_PROXY/HTTPS_PROXY) membuat Playwright mengarahkan
 * probe webServer dan request browser ke proxy, sehingga `127.0.0.1:3000` tidak
 * pernah dianggap siap. Bypass host lokal di sini.
 */
process.env.NO_PROXY = process.env.NO_PROXY
  ? `${process.env.NO_PROXY},${LOCAL_BYPASS}`
  : LOCAL_BYPASS;
process.env.no_proxy = process.env.NO_PROXY;

// Server dev perlu menjangkau Supabase (eksternal) lewat proxy kantor;
// Node fetch tidak membaca HTTP_PROXY tanpa flag ini.
process.env.NODE_USE_ENV_PROXY = process.env.NODE_USE_ENV_PROXY ?? "1";

// Pakai 127.0.0.1 (bukan localhost) agar probe tidak bergantung pada resolusi DNS.
// Konsekuensinya `next.config.ts` perlu `allowedDevOrigins: ["127.0.0.1"]`.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${LOCAL_HOST}:3000`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    proxy: {
      server: process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "direct://",
      bypass: LOCAL_BYPASS,
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Panggil binary Next langsung, tanpa lapisan shim shell Windows (lebih deterministik).
    command: "node node_modules/next/dist/bin/next dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});