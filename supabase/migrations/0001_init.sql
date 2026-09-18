-- ============================================================
-- Kerlomp — 0001_init.sql
-- Implementasi SCHEMA.md v1.0 (patuh supabase-postgres-best-practices)
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------- Enum ----------
create type sub_task_status as enum ('todo', 'in_progress', 'submitted', 'done');
create type submission_decision as enum ('pending', 'approved', 'rejected');
create type notification_type as enum (
  'task_assigned', 'task_rejected', 'task_approved',
  'deadline_h1', 'deadline_h0', 'mention_comment', 'system'
);

-- ---------- Tabel ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  wa_number_encrypted bytea,
  wa_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  deadline timestamptz,
  leader_id uuid not null references profiles(id) on delete restrict,
  invite_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index groups_leader_idx on groups(leader_id);

create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  guest_name text,
  guest_token uuid,
  joined_at timestamptz not null default now(),
  check ((user_id is not null and guest_token is null)
      or (user_id is null and guest_token is not null and guest_name is not null)),
  unique (group_id, user_id),
  unique (group_id, guest_token)
);
create index members_user_idx on members(user_id);
create index members_group_idx on members(group_id);

create table sub_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  assignee_id uuid not null references members(id) on delete cascade,
  status sub_task_status not null default 'todo',
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sub_tasks_group_idx on sub_tasks(group_id);
create index sub_tasks_assignee_idx on sub_tasks(assignee_id);
create index sub_tasks_deadline_idx on sub_tasks(deadline)
  where status in ('todo','in_progress');

create table submissions (
  id uuid primary key default gen_random_uuid(),
  sub_task_id uuid not null references sub_tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  note text not null check (char_length(note) >= 10),
  files jsonb not null default '[]'::jsonb,
  decision submission_decision not null default 'pending',
  leader_note text,
  decided_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index submissions_task_idx on submissions(sub_task_id, created_at desc);
create unique index submissions_one_pending_idx
  on submissions(sub_task_id) where decision = 'pending';
create index submissions_member_idx on submissions(member_id);
create index submissions_decided_by_idx on submissions(decided_by);

create table comments (
  id uuid primary key default gen_random_uuid(),
  sub_task_id uuid not null references sub_tasks(id) on delete cascade,
  author_member_id uuid not null references members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_task_idx on comments(sub_task_id, created_at);
create index comments_author_idx on comments(author_member_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications(user_id)
  where read_at is null;

create table reminder_log (
  sub_task_id uuid not null references sub_tasks(id) on delete cascade,
  reminder_window text not null check (reminder_window in ('h1', 'h0')),
  channel text not null check (channel in ('in_app', 'wa')),
  sent_at timestamptz not null default now(),
  provider text,
  status text not null default 'sent' check (status in ('sent','failed')),
  attempt int not null default 1,
  primary key (sub_task_id, reminder_window, channel)
);

-- ---------- Storage bucket ----------
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false);

-- ---------- Helper functions (schema privat) ----------
create schema if not exists private;

create or replace function private.is_member(p_group uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.members
    where group_id = p_group and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_leader(p_group uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.groups
    where id = p_group and leader_id = (select auth.uid())
  );
$$;

create or replace function private.my_member_id(p_group uuid)
returns uuid language sql security definer stable set search_path = '' as $$
  select id from public.members
  where group_id = p_group and user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.is_guest(p_group uuid, p_token uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.members
    where group_id = p_group and guest_token = p_token and user_id is null
  );
$$;

revoke execute on all functions in schema private from public, anon, authenticated;

-- ---------- RLS ----------
alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table members       enable row level security;
alter table sub_tasks     enable row level security;
alter table submissions   enable row level security;
alter table comments      enable row level security;
alter table notifications enable row level security;
alter table reminder_log  enable row level security;  -- tanpa policy client: service-only

create policy "profiles: membaca profil anggota yang satu grup"
  on profiles for select using (
    id = (select auth.uid())
    or exists (
      select 1 from members m1
      join members m2 on m2.group_id = m1.group_id
      where m1.user_id = (select auth.uid()) and m2.user_id = profiles.id
    )
  );

create policy "profiles: update milik sendiri"
  on profiles for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "groups: anggota membaca grupnya"
  on groups for select using ((select private.is_member(id)));

create policy "groups: pengguna login bisa membuat grup, jadi leader"
  on groups for insert with check (leader_id = (select auth.uid()));

create policy "groups: hanya leader update"
  on groups for update using (leader_id = (select auth.uid()))
  with check (leader_id = (select auth.uid()));

create policy "groups: hanya leader hapus"
  on groups for delete using (leader_id = (select auth.uid()));

create policy "members: anggota baca roster grupnya"
  on members for select using ((select private.is_member(group_id)));

create policy "members: leader bisa kick; user bisa keluar sendiri"
  on members for delete using (
    (select private.is_leader(group_id)) or user_id = (select auth.uid())
  );

create policy "members: user boleh edit display-name sendiri (non-sensitif)"
  on members for update using (
    user_id = (select auth.uid()) and guest_token is null
  ) with check (user_id = (select auth.uid()));

create policy "sub_tasks: anggota membaca"
  on sub_tasks for select using ((select private.is_member(group_id)));

create policy "sub_tasks: hanya leader membuat & assign"
  on sub_tasks for insert with check ((select private.is_leader(group_id)));

create policy "sub_tasks: leader update penuh; assignee hanya status"
  on sub_tasks for update using (
    (select private.is_leader(group_id))
    or assignee_id = (select private.my_member_id(group_id))
  );

create policy "sub_tasks: hanya leader hapus"
  on sub_tasks for delete using ((select private.is_leader(group_id)));

create policy "submissions: anggota grup membaca"
  on submissions for select using (
    (select private.is_member((select group_id from sub_tasks where id = sub_task_id)))
  );

create policy "submissions: assignee (login) menyerahkan bukti"
  on submissions for insert with check (
    member_id = (
      select private.my_member_id(st.group_id)
      from sub_tasks st where st.id = sub_task_id
    )
    and (select assignee_id from sub_tasks where id = sub_task_id) = member_id
    and decision = 'pending'
  );

create policy "submissions: hanya leader men-decide"
  on submissions for update using (
    (select private.is_leader((select group_id from sub_tasks where id = sub_task_id)))
  ) with check (
    (decision = 'approved' and leader_note is null)
    or (decision = 'rejected' and leader_note is not null and char_length(leader_note) >= 3)
    or decision = 'pending'
  );

create policy "comments: anggota grup membaca"
  on comments for select using (
    (select private.is_member((select group_id from sub_tasks where id = sub_task_id)))
  );

create policy "comments: anggota login menulis sebagai dirinya"
  on comments for insert with check (
    author_member_id = (select private.my_member_id(
      (select group_id from sub_tasks where id = sub_task_id)
    ))
  );

create policy "comments: penulis atau leader boleh hapus"
  on comments for delete using (
    author_member_id = (select id from members where user_id = (select auth.uid()) and id = comments.author_member_id)
    or (select private.is_leader((select group_id from sub_tasks where id = sub_task_id)))
  );

create policy "notifications: baca milik sendiri"
  on notifications for select using (user_id = (select auth.uid()));

create policy "notifications: mark-read milik sendiri"
  on notifications for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- Trigger: guard status transition ----------
create or replace function private.enforce_status_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_member_id(NEW.group_id);
  leader boolean := private.is_leader(NEW.group_id);
begin
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
  if NEW.status in ('submitted','done') and OLD.status is distinct from NEW.status then
    -- hanya RPC resmi (submit_proof / review_submission) yang menyetel GUC ini di transaksinya
    if coalesce(current_setting('app.allow_status_change', true), 'off') <> 'on' then
      raise exception 'status submitted/done hanya via fungsi resmi';
    end if;
  end if;
  return NEW;
end $$;

create trigger sub_tasks_guard
  before update on sub_tasks
  for each row execute function private.enforce_status_transition();

-- ---------- Trigger: touch updated_at ----------
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_groups_touch before update on groups
  for each row execute function private.touch_updated_at();
create trigger t_profiles_touch before update on profiles
  for each row execute function private.touch_updated_at();
create trigger t_subtasks_touch before update on sub_tasks
  for each row execute function private.touch_updated_at();

-- ---------- RPC: submit_proof ----------
create or replace function public.submit_proof(
  p_sub_task uuid, p_note text, p_files jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  st public.sub_tasks;
  m uuid;
  sid uuid;
begin
  select * into st from public.sub_tasks where id = p_sub_task;
  if not found then raise exception 'task tidak ada'; end if;
  select private.my_member_id(st.group_id) into m;
  if m is null or st.assignee_id <> m then raise exception 'bukan task kamu'; end if;
  if st.status <> 'in_progress' then raise exception 'harus berstatus Dikerjakan'; end if;
  if char_length(p_note) < 10 then raise exception 'bukti teks minimal 10 karakter'; end if;
  if jsonb_array_length(p_files) > 3 then raise exception 'maks 3 file'; end if;

  perform set_config('app.allow_status_change', 'on', true);
  insert into public.submissions (sub_task_id, member_id, note, files)
    values (p_sub_task, m, p_note, p_files) returning id into sid;
  update public.sub_tasks set status = 'submitted', updated_at = now() where id = p_sub_task;
  return sid;
end $$;

-- ---------- RPC: review_submission ----------
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
    decision = case when p_approve then 'approved' else 'rejected' end,
    leader_note = p_note, decided_by = (select auth.uid()), decided_at = now()
  where id = p_submission;

  update public.sub_tasks set
    status = case when p_approve then 'done' else 'in_progress' end,
    updated_at = now()
  where id = st.id;

  insert into public.notifications (user_id, type, payload)
    select pm.user_id,
           case when p_approve then 'task_approved'::notification_type else 'task_rejected'::notification_type end,
           jsonb_build_object('sub_task_id', st.id, 'title', st.title, 'note', p_note)
    from public.members pm where pm.id = st.assignee_id and pm.user_id is not null;
end $$;

-- ---------- After-signup: buat profil dari metadata Google ----------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
