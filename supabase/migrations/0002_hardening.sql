-- ============================================================
-- Kerlomp - 0002_hardening.sql
-- Remedi hasil audit Fase 2. Idempotent: aman dijalankan berulang.
--
-- Ringkasan:
--   1. Helper RLS wajib bisa di-EXECUTE `authenticated`. Kalau di-revoke,
--      policy yang memanggilnya gagal 42501 (terbukti saat verifikasi).
--   2. Policy dipersempit `to authenticated` supaya `anon` tidak dievaluasi ke helper.
--   3. WITH CHECK eksplisit pada update sub_tasks.
--   4. Realtime publication untuk tabel yang di-subscribe.
--   5. Policy storage bucket `proofs` (insert/update/delete assignee atau leader).
--   6. Least privilege: cabut TRUNCATE/REFERENCES/TRIGGER dan seluruh akses `anon`.
--   7. Grant eksplisit ke `authenticated` (antisipasi tabel tidak auto-expose ke Data API).
--   8. Hardening fungsi trigger (security definer + search_path).
-- ============================================================

-- ---------- 1. Hardening fungsi trigger ----------
create or replace function private.touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- Trigger TIDAK butuh EXECUTE untuk menyala, jadi aman dicabut dari semua role.
revoke execute on function private.enforce_status_transition() from public, anon, authenticated, service_role;
revoke execute on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function private.touch_updated_at() from public, anon, authenticated, service_role;

-- ---------- 2. EXECUTE + USAGE helper untuk authenticated ----------
revoke execute on all functions in schema private from public, anon, service_role;
revoke execute on function private.is_guest(uuid, uuid) from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_leader(uuid) to authenticated;
grant execute on function private.my_member_id(uuid) to authenticated;

-- ---------- 3. Policy RLS: `to authenticated` + WITH CHECK ----------

-- profiles
drop policy if exists "profiles: membaca profil anggota yang satu grup" on public.profiles;
create policy "profiles: membaca profil anggota yang satu grup"
  on public.profiles for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.members m1
      join public.members m2 on m2.group_id = m1.group_id
      where m1.user_id = (select auth.uid()) and m2.user_id = profiles.id
    )
  );

drop policy if exists "profiles: update milik sendiri" on public.profiles;
create policy "profiles: update milik sendiri"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- groups
drop policy if exists "groups: anggota membaca grupnya" on public.groups;
create policy "groups: anggota membaca grupnya"
  on public.groups for select to authenticated
  using ((select private.is_member(id)));

drop policy if exists "groups: pengguna login bisa membuat grup, jadi leader" on public.groups;
create policy "groups: pengguna login bisa membuat grup, jadi leader"
  on public.groups for insert to authenticated
  with check (leader_id = (select auth.uid()));

drop policy if exists "groups: hanya leader update" on public.groups;
create policy "groups: hanya leader update"
  on public.groups for update to authenticated
  using (leader_id = (select auth.uid()))
  with check (leader_id = (select auth.uid()));

drop policy if exists "groups: hanya leader hapus" on public.groups;
create policy "groups: hanya leader hapus"
  on public.groups for delete to authenticated
  using (leader_id = (select auth.uid()));

-- members
drop policy if exists "members: anggota baca roster grupnya" on public.members;
create policy "members: anggota baca roster grupnya"
  on public.members for select to authenticated
  using ((select private.is_member(group_id)));

drop policy if exists "members: leader bisa kick; user bisa keluar sendiri" on public.members;
create policy "members: leader bisa kick; user bisa keluar sendiri"
  on public.members for delete to authenticated
  using (
    (select private.is_leader(group_id)) or user_id = (select auth.uid())
  );

drop policy if exists "members: user boleh edit display-name sendiri (non-sensitif)" on public.members;
create policy "members: user boleh edit display-name sendiri (non-sensitif)"
  on public.members for update to authenticated
  using (user_id = (select auth.uid()) and guest_token is null)
  with check (user_id = (select auth.uid()));

-- sub_tasks
drop policy if exists "sub_tasks: anggota membaca" on public.sub_tasks;
create policy "sub_tasks: anggota membaca"
  on public.sub_tasks for select to authenticated
  using ((select private.is_member(group_id)));

drop policy if exists "sub_tasks: hanya leader membuat & assign" on public.sub_tasks;
create policy "sub_tasks: hanya leader membuat & assign"
  on public.sub_tasks for insert to authenticated
  with check ((select private.is_leader(group_id)));

drop policy if exists "sub_tasks: leader update penuh; assignee hanya status" on public.sub_tasks;
create policy "sub_tasks: leader update penuh; assignee hanya status"
  on public.sub_tasks for update to authenticated
  using (
    (select private.is_leader(group_id))
    or assignee_id = (select private.my_member_id(group_id))
  )
  with check (
    (select private.is_leader(group_id))
    or assignee_id = (select private.my_member_id(group_id))
  );

drop policy if exists "sub_tasks: hanya leader hapus" on public.sub_tasks;
create policy "sub_tasks: hanya leader hapus"
  on public.sub_tasks for delete to authenticated
  using ((select private.is_leader(group_id)));

-- submissions
drop policy if exists "submissions: anggota grup membaca" on public.submissions;
create policy "submissions: anggota grup membaca"
  on public.submissions for select to authenticated
  using (
    (select private.is_member((select group_id from public.sub_tasks where id = sub_task_id)))
  );

drop policy if exists "submissions: assignee (login) menyerahkan bukti" on public.submissions;
create policy "submissions: assignee (login) menyerahkan bukti"
  on public.submissions for insert to authenticated
  with check (
    member_id = (
      select private.my_member_id(st.group_id)
      from public.sub_tasks st where st.id = sub_task_id
    )
    and (select assignee_id from public.sub_tasks where id = sub_task_id) = member_id
    and decision = 'pending'
  );

drop policy if exists "submissions: hanya leader men-decide" on public.submissions;
create policy "submissions: hanya leader men-decide"
  on public.submissions for update to authenticated
  using (
    (select private.is_leader((select group_id from public.sub_tasks where id = sub_task_id)))
  )
  with check (
    (decision = 'approved' and leader_note is null)
    or (decision = 'rejected' and leader_note is not null and char_length(leader_note) >= 3)
    or decision = 'pending'
  );

-- comments
drop policy if exists "comments: anggota grup membaca" on public.comments;
create policy "comments: anggota grup membaca"
  on public.comments for select to authenticated
  using (
    (select private.is_member((select group_id from public.sub_tasks where id = sub_task_id)))
  );

drop policy if exists "comments: anggota login menulis sebagai dirinya" on public.comments;
create policy "comments: anggota login menulis sebagai dirinya"
  on public.comments for insert to authenticated
  with check (
    author_member_id = (
      select private.my_member_id(
        (select group_id from public.sub_tasks where id = sub_task_id)
      )
    )
  );

drop policy if exists "comments: penulis atau leader boleh hapus" on public.comments;
create policy "comments: penulis atau leader boleh hapus"
  on public.comments for delete to authenticated
  using (
    author_member_id = (
      select private.my_member_id((select group_id from public.sub_tasks where id = sub_task_id))
    )
    or (select private.is_leader((select group_id from public.sub_tasks where id = sub_task_id)))
  );

-- notifications
drop policy if exists "notifications: baca milik sendiri" on public.notifications;
create policy "notifications: baca milik sendiri"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notifications: mark-read milik sendiri" on public.notifications;
create policy "notifications: mark-read milik sendiri"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- 4. Realtime publication ----------
do $$
declare
  t text;
begin
  foreach t in array array['sub_tasks', 'submissions', 'comments', 'members', 'notifications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- 5. Storage: policy bucket `proofs` ----------
-- Path wajib: <group_id>/<sub_task_id>/<file>. Select tetap hanya via signed URL (service role).
drop policy if exists "proofs: assignee atau leader unggah" on storage.objects;
create policy "proofs: assignee atau leader unggah"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and array_length(storage.foldername(name), 1) >= 2
    and (
      (select private.is_leader(((storage.foldername(name))[1])::uuid))
      or exists (
        select 1 from public.sub_tasks st
        where st.id = ((storage.foldername(name))[2])::uuid
          and st.group_id = ((storage.foldername(name))[1])::uuid
          and st.assignee_id = (select private.my_member_id(st.group_id))
      )
    )
  );

drop policy if exists "proofs: assignee atau leader ganti" on storage.objects;
create policy "proofs: assignee atau leader ganti"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'proofs'
    and array_length(storage.foldername(name), 1) >= 2
    and (
      (select private.is_leader(((storage.foldername(name))[1])::uuid))
      or exists (
        select 1 from public.sub_tasks st
        where st.id = ((storage.foldername(name))[2])::uuid
          and st.group_id = ((storage.foldername(name))[1])::uuid
          and st.assignee_id = (select private.my_member_id(st.group_id))
      )
    )
  )
  with check (
    bucket_id = 'proofs'
    and array_length(storage.foldername(name), 1) >= 2
    and (
      (select private.is_leader(((storage.foldername(name))[1])::uuid))
      or exists (
        select 1 from public.sub_tasks st
        where st.id = ((storage.foldername(name))[2])::uuid
          and st.group_id = ((storage.foldername(name))[1])::uuid
          and st.assignee_id = (select private.my_member_id(st.group_id))
      )
    )
  );

drop policy if exists "proofs: assignee atau leader hapus" on storage.objects;
create policy "proofs: assignee atau leader hapus"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'proofs'
    and array_length(storage.foldername(name), 1) >= 2
    and (
      (select private.is_leader(((storage.foldername(name))[1])::uuid))
      or exists (
        select 1 from public.sub_tasks st
        where st.id = ((storage.foldername(name))[2])::uuid
          and st.group_id = ((storage.foldername(name))[1])::uuid
          and st.assignee_id = (select private.my_member_id(st.group_id))
      )
    )
  );

-- ---------- 6. Least privilege ----------
-- TRUNCATE tidak tunduk RLS: cabut dari role API.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;

-- ---------- 7. Grant eksplisit (tabel baru tidak auto-expose ke Data API) ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;