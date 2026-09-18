-- ============================================================
-- Kerlomp - 0005_leader_membership.sql
-- Invarian: leader selalu punya baris `members`.
-- Ditemukan di 10 RLS test: policy berbasis `is_member` menyembunyikan grup
-- dari leader yang belum tercatat sebagai anggota.
-- Idempotent: aman dijalankan berulang.
-- ============================================================

create or replace function private.handle_new_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.members (group_id, user_id)
  values (NEW.id, NEW.leader_id)
  on conflict (group_id, user_id) do nothing;
  return NEW;
end $$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function private.handle_new_group();

-- Trigger tidak butuh EXECUTE; cabut dari role API.
revoke execute on function private.handle_new_group() from public, anon, authenticated, service_role;