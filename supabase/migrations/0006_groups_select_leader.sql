-- ============================================================
-- Kerlomp - 0006_groups_select_leader.sql
-- Perbaikan bug 42501 saat membuat grup.
--
-- Sebab: PostgREST melakukan INSERT ... RETURNING id. Postgres menerapkan
-- SELECT policy pada baris hasil RETURNING. Policy SELECT grup saat ini
-- `is_member(id)`, sedangkan baris `members` untuk leader baru dibuat oleh
-- AFTER INSERT trigger (on_group_created), yang berjalan setelah evaluasi
-- RETURNING. Akibatnya baris baru tidak terlihat -> "new row violates RLS".
--
-- Perbaikan: SELECT policy grup juga mengizinkan leader (leader_id = auth.uid()).
-- Sekaligus membersihkan objek probe sementara.
-- Idempotent.
-- ============================================================

drop policy if exists "groups: anggota membaca grupnya" on public.groups;
create policy "groups: anggota membaca grupnya"
  on public.groups for select to authenticated
  using (
    (select private.is_member(id))
    or leader_id = (select auth.uid())
  );

-- Bersihkan policy/objek probe sementara.
drop policy if exists "tmp permit insert" on public.groups;
alter table public.groups enable trigger on_group_created;
drop table if exists public._probe1;
drop table if exists public._probe2;
drop table if exists public._probe3;
drop table if exists public._probe4;
drop table if exists public._probe5;