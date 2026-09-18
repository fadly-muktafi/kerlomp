# Kerlomp — Database Schema & Security (SCHEMA.md)

> **Versi:** 1.0 · **Target:** PostgreSQL 15+ (Supabase) · **Prinsip:** RLS selalu ON, tidak ada `using (true)`, guest tidak pernah jadi `authenticated`.
> File ini adalah source-of-truth DDL; folder `supabase/migrations/` harus mirrornya satu-satu.

---

## 1. ERD Ringkas

```
auth.users (Supabase)
   │
   ▼ 1:1
profiles ──────────────┐
   │                   │
   │                   ▼
   │                members ──────────┐
   │                 │   ▲ guest?     │
   │                 │   │ (user_id nullable, guest_token)
   ▼                 │   │
 groups ─────────────┘   │
   │ 1:N                 │
   ▼                     │
 sub_tasks ◄─────────────┘  assignee_id → members.id (BUKAN user_id!)
   │ 1:N
   ├──► submissions   (bukti, 1 aktif per task, riwayat lengkap)
   ├──► comments
   └──► reminder_log
notifications (per user)
```

**Keputusan FK penting:** `sub_tasks.assignee_id → members.id`, bukan `auth.users.id`. Efeknya: claim flow guest hanya mengubah `members.user_id` — semua assignment otomatis ikut tanpa migrasi FK.

---

## 2. Enum & Extension

```sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create type sub_task_status as enum ('todo', 'in_progress', 'submitted', 'done');
create type submission_decision as enum ('pending', 'approved', 'rejected');
create type notification_type as enum (
  'task_assigned', 'task_rejected', 'task_approved',
  'deadline_h1', 'deadline_h0', 'mention_comment', 'system'
);
```

---

## 3. Tabel

### 3.1 `profiles`
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  wa_number_encrypted bytea,            -- ciphertext pgcrypto, bukan plaintext
  wa_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.2 `groups`
```sql
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
```

### 3.3 `members` — dual identity
```sql
create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,   -- NULL = guest
  guest_name text,                                          -- wajib bila user_id null
  guest_token uuid,                                         -- identitas cookie guest
  joined_at timestamptz not null default now(),

  -- tepat satu identitas:
  check ((user_id is not null and guest_token is null)
      or (user_id is null and guest_token is not null and guest_name is not null)),
  -- satu akun hanya sekali per grup; satu guest_token hanya sekali per grup
  unique (group_id, user_id),
  unique (group_id, guest_token)
);
create index members_user_idx on members(user_id);
create index members_group_idx on members(group_id);
```

> **Invarian:** leader grup selalu punya baris `members` (dibuat otomatis oleh trigger `on_group_created`, §6.4). Karena itu route handler `/api/join` yang menambahkan leader wajib memakai `on conflict (group_id, user_id) do nothing`.

### 3.4 `sub_tasks`
```sql
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
create index sub_tasks_deadline_idx on sub_tasks(deadline) where status in ('todo','in_progress');
```

### 3.5 `submissions` — bukti selesai
```sql
create table submissions (
  id uuid primary key default gen_random_uuid(),
  sub_task_id uuid not null references sub_tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  note text not null check (char_length(note) >= 10),
  files jsonb not null default '[]'::jsonb,     -- [{path, name, size, mime}] di bucket proofs
  decision submission_decision not null default 'pending',
  leader_note text,                              -- wajib diisi bila rejected (trigger-validated)
  decided_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index submissions_task_idx on submissions(sub_task_id, created_at desc);

-- hanya ada SATU submission pending per sub_task
create unique index submissions_one_pending_idx
  on submissions(sub_task_id) where decision = 'pending';

-- FK index (bc: schema-foreign-key-indexes) — Postgres tidak meng-index FK otomatis;
-- tanpa ini delete cascade / join besar jadi seq-scan
create index submissions_member_idx on submissions(member_id);
create index submissions_decided_by_idx on submissions(decided_by);
```

### 3.6 `comments`
```sql
create table comments (
  id uuid primary key default gen_random_uuid(),
  sub_task_id uuid not null references sub_tasks(id) on delete cascade,
  author_member_id uuid not null references members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_task_idx on comments(sub_task_id, created_at);
create index comments_author_idx on comments(author_member_id);  -- FK index
```

### 3.7 `notifications`
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications(user_id) where read_at is null;
```

### 3.8 `reminder_log` — idempotensi cron
```sql
create table reminder_log (
  sub_task_id uuid not null references sub_tasks(id) on delete cascade,
  reminder_window text not null check (reminder_window in ('h1', 'h0')),
  sent_at timestamptz not null default now(),
  channel text not null check (channel in ('in_app', 'wa')),
  provider text,                         -- 'meta' | 'openwa'
  status text not null default 'sent' check (status in ('sent','failed')),
  attempt int not null default 1,
  primary key (sub_task_id, reminder_window, channel)
);
```

---

## 4. Helper Functions (schema `private`, SECURITY DEFINER)

> **Best-practice Supabase (`security-rls-performance`):** helper security-definer **tidak hidup di schema `public`**. Mereka dibuat di schema `private` (tidak terexpose ke API), dengan `search_path = ''` + fully-qualified names, dan `EXECUTE` dicabut dari semua role. Policy memanggil mereka via subselect `(select private.is_member(...))` agar hasil per-query di-cache initplan, bukan di-evaluasi per-row.

```sql
create schema if not exists private;

-- apakah auth.uid() adalah anggota grup?
create or replace function private.is_member(p_group uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.members
    where group_id = p_group and user_id = (select auth.uid())
  );
$$;

-- apakah auth.uid() adalah leader grup?
create or replace function private.is_leader(p_group uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.groups
    where id = p_group and leader_id = (select auth.uid())
  );
$$;

-- members.id milik auth.uid() di grup tertentu
create or replace function private.my_member_id(p_group uuid)
returns uuid language sql security definer stable set search_path = '' as $$
  select id from public.members
  where group_id = p_group and user_id = (select auth.uid())
  limit 1;
$$;

-- validasi guest cookie (referensi saja: EXECUTE di-revoke total, dan server
-- membaca public.members langsung lewat service client; tidak dipanggil dari client)
create or replace function private.is_guest(p_group uuid, p_token uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.members
    where group_id = p_group and guest_token = p_token and user_id is null
  );
$$;

-- Helper yang dipanggil dari policy RLS WAJIB bisa di-EXECUTE oleh `authenticated`.
-- Kalau dicabut, policy gagal dengan 42501 "permission denied for function" saat user login
-- meng-query (terverifikasi empiris saat hardening remote). Policy dievaluasi sebagai role
-- pemanggil, bukan pemilik tabel.
revoke execute on all functions in schema private from public, anon, service_role;

grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_leader(uuid) to authenticated;
grant execute on function private.my_member_id(uuid) to authenticated;

-- `is_guest` tidak dipanggil policy (server membaca public.members langsung); biarkan tercabut.
revoke execute on function private.is_guest(uuid, uuid) from public, anon, authenticated, service_role;

-- Fungsi trigger tidak butuh EXECUTE untuk menyala; cabut dari semua role.
revoke execute on function private.enforce_status_transition() from public, anon, authenticated, service_role;
revoke execute on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function private.touch_updated_at() from public, anon, authenticated, service_role;

-- PENTING: `revoke ... on all functions` hanya mengenai fungsi yang SUDAH ada saat dijalankan.
-- Jalankan blok ini setelah semua fungsi `private.*` dibuat.
```

> Catatan keputusan ADR #6: guest read dirender di server (cookie → service client di route handler), sehingga **tidak ada policy guest di RLS**. Fungsi `private.is_guest` disimpan sebagai referensi; karena `EXECUTE`-nya di-revoke dari semua role, server melakukan validasi langsung ke `public.members` lewat service client, bukan memanggil helper ini.

---

## 5. Row Level Security

```sql
alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table members       enable row level security;
alter table sub_tasks     enable row level security;
alter table submissions   enable row level security;
alter table comments      enable row level security;
alter table notifications enable row level security;
alter table reminder_log  enable row level security;  -- tidak ada policy client: service-only
```

> Semua policy di bawah dijalankan dengan klausa `to authenticated` dan helper RLS di-grant ke `authenticated` (migrasi `0002_hardening.sql`). `anon` tidak punya akses tabel sama sekali.

### 5.1 profiles
```sql
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
-- insert profil dilakukan hook after-signup (service role); client tidak insert
```

### 5.2 groups
```sql
-- leader disertakan: PostgREST INSERT ... RETURNING mengevaluasi SELECT policy pada
-- baris baru, sementara baris `members` leader baru dibuat AFTER trigger (migrasi 0006).
create policy "groups: anggota membaca grupnya"
  on groups for select to authenticated
  using ((select private.is_member(id)) or leader_id = (select auth.uid()));

create policy "groups: siapa pun yang login bisa membuat grup, jadi leader"
  on groups for insert with check (leader_id = (select auth.uid()));

create policy "groups: hanya leader update"
  on groups for update using (leader_id = (select auth.uid()))
  with check (leader_id = (select auth.uid()));

create policy "groups: hanya leader hapus"
  on groups for delete using (leader_id = (select auth.uid()));
```

### 5.3 members
```sql
create policy "members: anggota baca roster grupnya"
  on members for select using ((select private.is_member(group_id)));

-- insert hanya via route handler server (/api/join dan claim) pakai service role.
-- client biasa TIDAK punya policy insert.

create policy "members: leader bisa kick; user bisa keluar sendiri"
  on members for delete using (
    (select private.is_leader(group_id)) or user_id = (select auth.uid())
  );

create policy "members: user boleh edit display-name sendiri (non-sensitif)"
  on members for update using (
    user_id = (select auth.uid()) and guest_token is null
  ) with check (user_id = (select auth.uid()));
```

### 5.4 sub_tasks
```sql
create policy "sub_tasks: anggota membaca"
  on sub_tasks for select using ((select private.is_member(group_id)));

create policy "sub_tasks: hanya leader membuat & assign"
  on sub_tasks for insert with check ((select private.is_leader(group_id)));

create policy "sub_tasks: leader update penuh; assignee hanya status"
  on sub_tasks for update using (
    (select private.is_leader(group_id))
    or assignee_id = (select private.my_member_id(group_id))
  );
-- Enforcement kolom: trigger di §6 membatasi assignee hanya boleh
-- mengubah status (todo<->in_progress), kolom lain di-freeze.

create policy "sub_tasks: hanya leader hapus"
  on sub_tasks for delete using ((select private.is_leader(group_id)));
```

### 5.5 submissions
```sql
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

-- delete: tidak ada policy → immutable (riwayat audit terjaga)
```

### 5.6 comments
```sql
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
```

### 5.7 notifications
```sql
create policy "notifications: baca milik sendiri"
  on notifications for select using (user_id = (select auth.uid()));
create policy "notifications: mark-read milik sendiri"
  on notifications for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- insert hanya service role (Edge remind-tick / trigger)
```

### 5.8 reminder_log
Tidak ada policy client. Akses full hanya `service_role`.

---

## 6. Triggers (defense in depth di atas RLS)

### 6.1 Status-transition guard
```sql
create or replace function private.enforce_status_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  me uuid;
  leader boolean;
begin
  -- Jalur RPC resmi (submit_proof / review_submission) sudah memvalidasi sendiri.
  -- Bypass HARUS di paling awal: kalau tidak, cabang assignee di bawah menolak
  -- transisi ke 'submitted' dan RPC resmi mustahil jalan (ditemukan di RLS test).
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

  -- transisi ke submitted/done hanya lewat RPC submit_proof / review_submission
  if NEW.status in ('submitted','done') and OLD.status is distinct from NEW.status then
    raise exception 'status submitted/done hanya via fungsi resmi';
  end if;

  return NEW;
end $$;

create trigger sub_tasks_guard
  before update on sub_tasks
  for each row execute function private.enforce_status_transition();
```

### 6.2 RPC resmi (dipanggil server route / edge)

```sql
-- assigne menyerahkan bukti + pindah ke submitted (atomik)
create or replace function public.submit_proof(p_sub_task uuid, p_note text, p_files jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
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

-- leader approve/reject (atomik + notifikasi)
create or replace function public.review_submission(p_submission uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions; st public.sub_tasks;
begin
  select * into s from public.submissions where id = p_submission and decision = 'pending';
  if not found then raise exception 'submission tidak ditemukan/closed'; end if;
  select * into st from public.sub_tasks where id = s.sub_task_id;
  if not private.is_leader(st.group_id) then raise exception 'hanya leader'; end if;
  if not p_approve and (p_note is null or char_length(p_note) < 3) then
    raise exception 'reject wajib alasan'; end if;

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
```

### 6.3 `updated_at` otomatis
```sql
create or replace function private.touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_groups_touch before update on groups for each row execute function private.touch_updated_at();
create trigger t_profiles_touch before update on profiles for each row execute function private.touch_updated_at();
create trigger t_subtasks_touch before update on sub_tasks for each row execute function private.touch_updated_at();
```

### 6.4 Leader otomatis jadi anggota

Policy berbasis `private.is_member` (grup, roster, sub_tasks, komentar) akan menyembunyikan grup dari leader yang belum punya baris `members`. Trigger ini menjamin invarian "leader selalu anggota" dan menghapus urutan operasi yang rapuh di aplikasi.

```sql
create or replace function private.handle_new_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.members (group_id, user_id)
  values (NEW.id, NEW.leader_id)
  on conflict (group_id, user_id) do nothing;
  return NEW;
end $$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function private.handle_new_group();

-- Trigger tidak butuh EXECUTE; cabut dari role API.
revoke execute on function private.handle_new_group() from public, anon, authenticated, service_role;
```

---

## 7. Storage: bucket `proofs`

```sql
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false);
```

**Kebijakan akses (storage.objects):**
- **Insert:** user login, path wajib `<group_id>/<sub_task_id>/<uuid>.<ext>`, dan user adalah assignee atau leader task tersebut. Ukuran ≤ 10MB ditegakkan juga di app route; di sini ditegakkan MIME allowlist lewat metadata.
- **Select:** hanya via `createSignedUrl` oleh server (bucket non-public → tanpa policy select client; signed URL ditanda-tangani service role, expiry 3600s).
- **Update:** assignee pemilik task atau leader, khusus mengganti file bukti (upsert). Upsert butuh INSERT + SELECT + UPDATE sekaligus, bukan INSERT saja.
- **Delete:** assignee pemilik task atau leader (untuk ganti bukti sebelum resubmit).
- Upload flow: client → `POST /api/proofs/sign-upload` → server validasi (MIME whitelist: jpeg/png/webp/pdf/docx/pptx; magic bytes dicek post-upload) → `createSignedUploadUrl` → client PUT langsung ke storage.

---

## 8. Keagenan Data (data agency)

- **Hapus akun:** `auth.users` delete → cascade profiles → members(user rows) → comments/submissions ikut terhapus. File proofs milik grup yang non-leader tidak dihapus otomatis selama grup hidup — dibersihkan saat grup dihapus (cascade sub_tasks → cleanup storage via Edge schedule mingguan: file yatim di `proofs/` dihapus).
- **Hapus grup:** cascade semua sub-tabel; Edge job hapus prefix `proofs/<group_id>/` di storage.
- **Retensi reminder_log:** purge otomatis row > 90 hari (pg_cron mingguan).

---

## 9. Indexes rekapan & performa target

Sudah ada di DDL: `sub_tasks(group_id)`, `sub_tasks(assignee_id)`, partial index deadline (hanya active), `members(group_id)`, `notifications(user_id) where read_at is null`, unique partial pending submission.
Target: query board grup (grup + members + sub_tasks + latest submissions) < 100ms pada 50 anggota × 100 task.

---

## 9b. Kepatuhan Supabase Best Practices (ringkasan)

Diadopsi dari skill `supabase-postgres-best-practices`. Daftar ini referensi cepat; detail rule ada di `references/` skill tersebut.

| Rule | Status di schema ini |
|---|---|
| `security-rls-basics` (RLS + force) | ✅ RLS ON semua tabel multi-tenant; pertimbangkan `force row level security` hanya jika ada transfer ownership |
| `security-rls-performance` | ✅ `(select auth.uid())` di semua policy; helper di schema `private` + revoke EXECUTE; column di policy ter-index |
| `schema-data-types` | ✅ semua timestamp `timestamptz`; teks pakai `text` + CHECK, bukan `varchar(n)`; enum jelas |
| `schema-foreign-key-indexes` | ✅ semua FK ter-index (lihat DDL + tambahan index di §3) |
| `query-partial-indexes` | ✅ index partial: `sub_tasks` deadline (aktif saja), `notifications` unread, `submissions` pending |
| `conn-pooling` | ⚠️ App memakai **Supavisor session mode** untuk migrasi + transaction mode untuk runtime; duplikasi prepared statements nonaktif di serverless (Vercel) |
| `query-missing-indexes` | 🔁 Audit periodik via query detector pg_constraint/pg_index (lihat skill) sebelum rilis |
| `monitor-explain-analyze` | 🔁 Sebelum v1.1: jalankan EXPLAIN ANALYZE pada query board pada data dummy 50 anggota × 100 task, target < 100ms |

---

## 10. Test wajib (gate sebelum merge)

1. User A buat grup; user B (belum join) `select * from sub_tasks` → 0 rows.
2. Guest cookie → query via service path sukses; query anon langsung `select` → 0 rows.
3. Assignee update status `in_progress → submitted` lewat UPDATE langsung → **error** (trigger).
4. `submit_proof` task orang lain → exception.
5. Dua submit_proof bersamaan → satu gagal (unique partial index).
6. Leader reject tanpa note → exception.
7. Non-leader update title task → ditolak RLS.
8. Re-login Google: claim → `members.user_id` terisi, guest_token null, sub_tasks otomatis menunjuk akun.
9. Reminder cron dua kali jalan → `reminder_log` tidak duplikat (PK conflict di-skip).
10. Storage: anon get object `proofs/...` → 403; signed URL → 200 dalam 60 menit, 403 setelahnya.
