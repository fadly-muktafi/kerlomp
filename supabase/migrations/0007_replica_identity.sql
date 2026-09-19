-- ============================================================
-- Kerlomp - 0007_replica_identity.sql
-- Event DELETE/UPDATE postgres_changes tidak pernah dikirim ketika
-- replica identity DEFAULT (PK only): server Realtime tidak bisa mengevaluasi
-- RLS pada baris yang sudah terhapus. Solusi resmi Supabase: REPLICA IDENTITY FULL.
-- Idempotent.
-- ============================================================

alter table public.sub_tasks     replica identity full;
alter table public.submissions   replica identity full;
alter table public.comments      replica identity full;
alter table public.members       replica identity full;
alter table public.notifications replica identity full;