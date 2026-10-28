create extension if not exists pgcrypto with schema extensions;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Love' check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ROOMS
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null unique, -- a user belongs to at most one room
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index on public.room_members(room_id);
grant select on public.room_members to authenticated;
grant all on public.room_members to service_role;
alter table public.room_members enable row level security;

create or replace function public.is_room_member(_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = _room and user_id = auth.uid())
$$;

create policy "members read room" on public.rooms for select to authenticated using (public.is_room_member(id));
create policy "members read members" on public.room_members for select to authenticated using (public.is_room_member(room_id));

create policy "own or partner profile" on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.room_members a join public.room_members b on a.room_id = b.room_id
    where a.user_id = auth.uid() and b.user_id = profiles.id)
);
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- INVITATIONS (only hashes stored; no client grants)
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz not null default now()
);
create index on public.invitations(room_id);
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null default auth.uid(),
  client_id uuid not null,
  kind text not null check (kind in ('text','image','video','audio','sticker')),
  body text check (body is null or char_length(body) <= 4000),
  media_path text,
  media_mime text,
  media_size bigint,
  created_at timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index on public.messages(room_id, created_at desc);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select to authenticated using (public.is_room_member(room_id));
create policy "members send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_room_member(room_id)
    and (select count(*) from public.room_members m where m.room_id = messages.room_id) = 2);
-- no update/delete policies: messages are immutable

create or replace function public.validate_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  new.created_at := now();
  if new.kind in ('text') and (new.body is null or char_length(btrim(new.body)) = 0) then
    raise exception 'Message cannot be empty';
  end if;
  if new.kind = 'sticker' and (new.body is null or char_length(new.body) > 64) then
    raise exception 'Invalid sticker';
  end if;
  if new.kind in ('image','video','audio') then
    if new.media_path is null or split_part(new.media_path,'/',1) <> new.room_id::text
       or split_part(new.media_path,'/',2) <> new.sender_id::text then
      raise exception 'Invalid media path';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = new.media_path and o.owner_id = new.sender_id::text) then
      raise exception 'Media not uploaded';
    end if;
    if new.kind = 'image' and new.media_mime not like 'image/%' then raise exception 'Bad type'; end if;
    if new.kind = 'video' and new.media_mime not like 'video/%' then raise exception 'Bad type'; end if;
    if new.kind = 'audio' and new.media_mime not like 'audio/%' then raise exception 'Bad type'; end if;
  else
    new.media_path := null; new.media_mime := null; new.media_size := null;
  end if;
  select count(*) into recent from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent >= 40 then raise exception 'Slow down a little, love'; end if;
  return new;
end $$;
create trigger messages_validate before insert on public.messages for each row execute function public.validate_message();

-- RECEIPTS
create table public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (message_id, user_id)
);
grant select on public.message_receipts to authenticated;
grant all on public.message_receipts to service_role;
alter table public.message_receipts enable row level security;
create policy "members read receipts" on public.message_receipts for select to authenticated using (
  exists (select 1 from public.messages m where m.id = message_id and public.is_room_member(m.room_id)));

-- TYPING
create table public.typing_status (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
grant select, insert, update on public.typing_status to authenticated;
grant all on public.typing_status to service_role;
alter table public.typing_status enable row level security;
create policy "members read typing" on public.typing_status for select to authenticated using (public.is_room_member(room_id));
create policy "own typing insert" on public.typing_status for insert to authenticated with check (user_id = auth.uid() and public.is_room_member(room_id));
create policy "own typing update" on public.typing_status for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_room_member(room_id));

-- PREFERENCES
create table public.user_preferences (
  user_id uuid primary key default auth.uid(),
  sound_enabled boolean not null default true,
  in_app_notifications boolean not null default true,
  show_typing boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
alter table public.user_preferences enable row level security;
create policy "own prefs select" on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy "own prefs insert" on public.user_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "own prefs update" on public.user_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- new user bootstrap
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data->>'display_name', 40), ''), split_part(new.email,'@',1), 'Love'))
  on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RPCs
create or replace function public.create_room() returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select room_id into rid from public.room_members where user_id = uid;
  if rid is not null then return rid; end if;
  insert into public.rooms (created_by) values (uid) returning id into rid;
  insert into public.room_members (room_id, user_id) values (rid, uid);
  return rid;
end $$;

create or replace function public.create_invitation() returns json
language plpgsql security definer set search_path = public, extensions as $$
declare rid uuid; uid uuid := auth.uid(); alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea; code text := ''; i int; exp timestamptz := now() + interval '24 hours';
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select room_id into rid from public.room_members where user_id = uid;
  if rid is null then raise exception 'Create a room first'; end if;
  if (select count(*) from public.room_members where room_id = rid) >= 2 then raise exception 'Your room is already paired'; end if;
  if (select count(*) from public.invitations where created_by = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many codes, try again later'; end if;
  update public.invitations set revoked_at = now() where room_id = rid and revoked_at is null and used_at is null;
  raw := gen_random_bytes(8);
  for i in 0..7 loop code := code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1); end loop;
  code := 'JU-' || substr(code,1,4) || '-' || substr(code,5,4);
  insert into public.invitations (room_id, code_hash, created_by, expires_at)
  values (rid, encode(digest(code, 'sha256'), 'hex'), uid, exp);
  return json_build_object('code', code, 'expires_at', exp);
end $$;

create or replace function public.revoke_invitations() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.invitations set revoked_at = now()
  where created_by = auth.uid() and revoked_at is null and used_at is null;
end $$;

create or replace function public.active_invitation() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('expires_at', expires_at, 'created_at', created_at)
  from public.invitations where created_by = auth.uid() and revoked_at is null and used_at is null and expires_at > now()
  order by created_at desc limit 1
$$;

create table public.join_attempts (user_id uuid not null, attempted_at timestamptz not null default now());
create index on public.join_attempts(user_id, attempted_at);
grant all on public.join_attempts to service_role;
alter table public.join_attempts enable row level security;

create or replace function public.join_room(_code text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); inv public.invitations%rowtype; n int; norm text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if (select count(*) from public.join_attempts where user_id = uid and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many attempts. Please wait a few minutes.'; end if;
  insert into public.join_attempts (user_id) values (uid);
  if exists (select 1 from public.room_members where user_id = uid) then raise exception 'You are already in a room'; end if;
  norm := upper(regexp_replace(coalesce(_code,''), '[^A-Za-z0-9]', '', 'g'));
  if norm like 'JU%' then norm := substr(norm, 3); end if;
  if char_length(norm) <> 8 then raise exception 'That code is not valid'; end if;
  norm := 'JU-' || substr(norm,1,4) || '-' || substr(norm,5,4);
  select * into inv from public.invitations where code_hash = encode(digest(norm,'sha256'),'hex') for update;
  if not found then raise exception 'That code is not valid'; end if;
  if inv.used_at is not null then raise exception 'That code was already used'; end if;
  if inv.revoked_at is not null then raise exception 'That code was revoked'; end if;
  if inv.expires_at <= now() then raise exception 'That code has expired'; end if;
  if inv.created_by = uid then raise exception 'You cannot use your own code'; end if;
  perform 1 from public.rooms where id = inv.room_id for update; -- serialize joins per room
  select count(*) into n from public.room_members where room_id = inv.room_id;
  if n >= 2 then raise exception 'This room is already full'; end if;
  insert into public.room_members (room_id, user_id) values (inv.room_id, uid);
  update public.invitations set used_at = now(), used_by = uid where id = inv.id;
  update public.invitations set revoked_at = now() where room_id = inv.room_id and id <> inv.id and used_at is null and revoked_at is null;
  return inv.room_id;
end $$;

create or replace function public.enforce_two_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.rooms where id = new.room_id for update;
  if (select count(*) from public.room_members where room_id = new.room_id) >= 2 then
    raise exception 'Room is full';
  end if;
  return new;
end $$;
create trigger room_members_max_two before insert on public.room_members for each row execute function public.enforce_two_members();

create or replace function public.mark_room_read(_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not public.is_room_member(_room) then raise exception 'Forbidden'; end if;
  insert into public.message_receipts (message_id, user_id, delivered_at, read_at)
    select m.id, uid, now(), now() from public.messages m
    where m.room_id = _room and m.sender_id <> uid
  on conflict (message_id, user_id) do update set read_at = coalesce(message_receipts.read_at, now());
  update public.room_members set last_read_at = now() where room_id = _room and user_id = uid;
end $$;

create or replace function public.mark_delivered(_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not public.is_room_member(_room) then raise exception 'Forbidden'; end if;
  insert into public.message_receipts (message_id, user_id)
    select m.id, uid from public.messages m where m.room_id = _room and m.sender_id <> uid
  on conflict do nothing;
end $$;

create or replace function public.unread_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.messages m join public.room_members rm on rm.room_id = m.room_id
  where rm.user_id = auth.uid() and m.sender_id <> auth.uid()
  and not exists (select 1 from public.message_receipts r where r.message_id = m.id and r.user_id = auth.uid() and r.read_at is not null)
$$;

revoke execute on function public.create_room, public.create_invitation, public.revoke_invitations, public.active_invitation,
  public.join_room(text), public.mark_room_read(uuid), public.mark_delivered(uuid), public.unread_count, public.is_room_member(uuid) from public, anon;
grant execute on function public.create_room, public.create_invitation, public.revoke_invitations, public.active_invitation,
  public.join_room(text), public.mark_room_read(uuid), public.mark_delivered(uuid), public.unread_count, public.is_room_member(uuid) to authenticated;
revoke execute on function public.validate_message, public.handle_new_user, public.enforce_two_members from public, anon, authenticated;

alter publication supabase_realtime add table public.messages, public.message_receipts, public.typing_status, public.room_members;
