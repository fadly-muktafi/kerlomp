-- ============================================================
-- Kerlomp - 0004_fix_rpc_and_trigger.sql
-- Memperbaiki dua bug yang ditemukan oleh 10 RLS test gate.
-- Idempotent: aman dijalankan berulang.
-- ============================================================

-- BUG 1: trigger `enforce_status_transition` mengecek cabang assignee lebih dulu,
-- sehingga RPC resmi `submit_proof` (yang menyetel app.allow_status_change='on')
-- tetap ditolak: "transisi status assignee hanya todo<->in_progress".
-- Perbaikan: hormati GUC bypass di paling awal, sebelum pengecekan kolom/status.
create or replace function private.enforce_status_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  me uuid;
  leader boolean;
begin
  -- Jalur RPC resmi (submit_proof / review_submission) sudah memvalidasi sendiri.
  if coalesce(current_setting('app.allow_status_change', true), 'off') = 'on' then
    return NEW;
  end if;

  me := private.my_member_id(NEW.group_id);
  leader := private.is_leader(NEW.group_id);

  -- assignee langsung: hanya todo<->in_progress, kolom lain harus identik
  if NEW.assignee_id = me and not leader then
    if NEW.title is distinct from OLD.title
       or NEW.description is distinct from OLD.description
       or NEW.assignee_id is distinct from OLD.assignee_id
       or NEW.deadline is distinct from OLD.deadline
       or NEW.group_id is distinct from OLD.group_id then
      raise exception 'assignee hanya boleh mengubah status';
    end if;
    if not ((OLD.status = 'todo'        and NEW.status in ('todo','in_progress'))
         or (OLD.status = 'in_progress' and NEW.status in ('todo','in_progress'))) then
      raise exception 'transisi status assignee hanya todo<->in_progress; submitted via submit_proof';
    end if;
  end if;

  -- submitted/done hanya lewat RPC resmi (GUC sudah dicek di atas)
  if NEW.status in ('submitted','done') and OLD.status is distinct from NEW.status then
    raise exception 'status submitted/done hanya via fungsi resmi';
  end if;

  return NEW;
end $$;

revoke execute on function private.enforce_status_transition() from public, anon, authenticated, service_role;

-- BUG 2: `review_submission` meng-assign hasil CASE (bertipe text) ke kolom enum
-- `submission_decision` / `sub_task_status`, gagal dengan "expression is of type text".
-- Perbaikan: cast eksplisit ke tipe enum.
create or replace function public.review_submission(
  p_submission uuid, p_approve boolean, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  st public.sub_tasks;
begin
  select * into s from public.submissions where id = p_submission and decision = 'pending';
  if not found then raise exception 'submission tidak ditemukan/closed'; end if;
  select * into st from public.sub_tasks where id = s.sub_task_id;
  if not private.is_leader(st.group_id) then raise exception 'hanya leader'; end if;
  if not p_approve and (p_note is null or char_length(p_note) < 3) then
    raise exception 'reject wajib alasan';
  end if;

  perform set_config('app.allow_status_change', 'on', true);
  update public.submissions set
    decision = case when p_approve then 'approved'::public.submission_decision else 'rejected'::public.submission_decision end,
    leader_note = p_note, decided_by = (select auth.uid()), decided_at = now()
  where id = p_submission;

  update public.sub_tasks set
    status = case when p_approve then 'done'::public.sub_task_status else 'in_progress'::public.sub_task_status end,
    updated_at = now()
  where id = st.id;

  insert into public.notifications (user_id, type, payload)
    select pm.user_id,
           case when p_approve then 'task_approved'::public.notification_type else 'task_rejected'::public.notification_type end,
           jsonb_build_object('sub_task_id', st.id, 'title', st.title, 'note', p_note)
    from public.members pm where pm.id = st.assignee_id and pm.user_id is not null;
end $$;

revoke execute on function public.review_submission(uuid, boolean, text) from public, anon;
grant execute on function public.review_submission(uuid, boolean, text) to authenticated, service_role;