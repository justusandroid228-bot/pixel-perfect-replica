create policy "room members read media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_room_member(((storage.foldername(name))[1])::uuid));
create policy "members upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_room_member(((storage.foldername(name))[1])::uuid)
    and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','gif','heic','mp4','mov','webm','m4a','mp3','ogg','aac','wav'));
