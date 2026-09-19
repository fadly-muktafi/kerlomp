-- ============================================================
-- Kerlomp - 0009_group_change_broadcast_fix.sql
-- Perbaikan fungsi broadcast: tabel `comments` tidak punya kolom group_id,
-- jadi `NEW.group_id` error "record new has no field group_id".
-- group_id komentar diambil lewat sub_tasks.
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