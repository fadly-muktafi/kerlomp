<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` - verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kerlomp

Dokumen kebenaran, urut menang: `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `SCHEMA.md`, `RULES.md`. Baca `RULES.md` sebelum menulis kode.

Ringkasan operasional:

- Next.js 16 (App Router) + React 19.2 + Tailwind v4 + Supabase.
- Refresh sesi di `proxy.ts` (Next 16 menggantikan `middleware.ts`).
- Migrasi DB di `supabase/migrations/`, alur imperative (RULES.md §8).
- `service_role` tidak pernah masuk ke client; hanya `lib/supabase/admin.ts` di server.
- Design token di `app/globals.css`; dilarang hex literal di komponen.
- Perintah: `pnpm dev`, `pnpm lint` (eslint + tsc), `pnpm test`, `pnpm test:e2e`.