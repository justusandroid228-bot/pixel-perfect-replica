create or replace function public.join_room(_code text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); inv public.invitations%rowtype; n int; norm text; mine uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if (select count(*) from public.join_attempts where user_id = uid and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many attempts. Please wait a few minutes.'; end if;
  insert into public.join_attempts (user_id) values (uid);
  select room_id into mine from public.room_members where user_id = uid;
  if mine is not null and (select count(*) from public.room_members where room_id = mine) >= 2 then
    raise exception 'You are already paired'; end if;
  norm := upper(regexp_replace(coalesce(_code,''), '[^A-Za-z0-9]', '', 'g'));
  if norm like 'JU%' and char_length(norm) = 10 then norm := substr(norm, 3); end if;
  if char_length(norm) <> 8 then raise exception 'That code is not valid'; end if;
  norm := 'JU-' || substr(norm,1,4) || '-' || substr(norm,5,4);
  select * into inv from public.invitations where code_hash = encode(digest(norm,'sha256'),'hex') for update;
  if not found then raise exception 'That code is not valid'; end if;
  if inv.used_at is not null then raise exception 'That code was already used'; end if;
  if inv.revoked_at is not null then raise exception 'That code was revoked'; end if;
  if inv.expires_at <= now() then raise exception 'That code has expired'; end if;
  if inv.created_by = uid or inv.room_id = mine then raise exception 'You cannot use your own code'; end if;
  perform 1 from public.rooms where id = inv.room_id for update; -- serialize joins per room
  select count(*) into n from public.room_members where room_id = inv.room_id;
  if n >= 2 then raise exception 'This room is already full'; end if;
  if mine is not null then
    -- the caller's own room has only them in it (checked above) and therefore no messages; drop it
    delete from public.rooms where id = mine;
  end if;
  insert into public.room_members (room_id, user_id) values (inv.room_id, uid);
  update public.invitations set used_at = now(), used_by = uid where id = inv.id;
  update public.invitations set revoked_at = now() where room_id = inv.room_id and id <> inv.id and used_at is null and revoked_at is null;
  return inv.room_id;
end $$;
revoke execute on function public.join_room(text) from public, anon;
grant execute on function public.join_room(text) to authenticated;
