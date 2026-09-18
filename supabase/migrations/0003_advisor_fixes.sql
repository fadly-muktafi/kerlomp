-- ============================================================
-- Kerlomp - 0003_advisor_fixes.sql
-- Menutup temuan security advisor setelah 0002.
-- Idempotent: aman dijalankan berulang.
-- ============================================================

-- RPC resmi hanya untuk role login. Fungsi tetap meng-otorisasi diri
-- (cek membership/leader), ini defense in depth.
revoke execute on function public.submit_proof(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_proof(uuid, text, jsonb) to authenticated, service_role;

revoke execute on function public.review_submission(uuid, boolean, text) from public, anon;
grant execute on function public.review_submission(uuid, boolean, text) to authenticated, service_role;

-- Fungsi managed Supabase (event trigger RLS auto-enable): cabut dari role API.
-- Event trigger berjalan sebagai owner, tidak butuh EXECUTE role API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- `reminder_log` sengaja service-only (cron/edge). Policy deny eksplisit
-- supaya niatnya terbaca dan advisor "RLS enabled no policy" hilang.
drop policy if exists "reminder_log: tanpa akses client" on public.reminder_log;
create policy "reminder_log: tanpa akses client"
  on public.reminder_log for all to authenticated
  using (false)
  with check (false);