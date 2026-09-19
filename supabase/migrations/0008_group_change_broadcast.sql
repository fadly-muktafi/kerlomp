-- ============================================================
-- Kerlomp - 0008_group_change_broadcast.sql
-- Guest tidak punya JWT Supabase, jadi postgres_changes tidak pernah
-- terkirim untuknya. Solusi: broadcast sinyal "data changed" dari DB
-- via realtime.send() ke topic `group:<group_id>` (public, tanpa auth).
-- Isi data TIDAK dibawa broadcast; klien refetch via API (RLS/cookie).
-- Idempotent.
-- ============================================================

create or replace function private.notify_group_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  g uuid;
  kind text := case TG_TABLE_NAME
    when 'comments' then 'comments'
    when 'sub_tasks' then 'tasks'
    when 'members' then 'members'
    else 'all'
  end;
begin
  -- `comments` tidak punya kolom group_id; ambil lewat sub_tasks.
  if TG_TABLE_NAME = 'comments' then
    select group_id into g from public.sub_tasks
    where id = coalesce(NEW.sub_task_id, OLD.sub_task_id);
  else
    g := coalesce(NEW.group_id, OLD.group_id);
  end if;

  if g is null then
    return coalesce(NEW, OLD);
  end if;

  perform realtime.send(
    jsonb_build_object('kind', kind),
    'data_change',
    'group:' || g::text,
    false
  );
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists notify_comments_change on public.comments;
create trigger notify_comments_change
  after insert or update or delete on public.comments
  for each row execute function private.notify_group_change();

drop trigger if exists notify_subtasks_change on public.sub_tasks;
create trigger notify_subtasks_change
  after insert or update or delete on public.sub_tasks
  for each row execute function private.notify_group_change();

drop trigger if exists notify_members_change on public.members;
create trigger notify_members_change
  after insert or update or delete on public.members
  for each row execute function private.notify_group_change();

-- Trigger tidak butuh EXECUTE; cabut dari role API.
revoke execute on function private.notify_group_change() from public, anon, authenticated, service_role;