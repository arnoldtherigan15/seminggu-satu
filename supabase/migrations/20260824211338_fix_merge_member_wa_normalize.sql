-- ============================================================
-- merge_member_wa() bug fix: it matched rows with an EXACT string
-- compare (wa = from_wa). That's fine for `members` (always inserted
-- through waKey() normalization -- member-setup/member-login), but
-- `registrations` has old rows from the pre-Postgres Sheets migration
-- stored un-normalized (e.g. "085171005800" or "85155108039" instead
-- of "6285171005800") -- register-workshop normalizes on insert now,
-- but this legacy data never got backfilled. Exact-match silently
-- skipped those rows: a "Change Active Number" or "Merge" would leave
-- them behind under their old raw wa, looking like a phantom separate
-- "not registered" person with the same name forever.
--
-- Fix: match on wa_key(wa) (a SQL port of the same normalization
-- _shared/auth.ts:waKey() does) instead of the raw column, and WRITE
-- the already-normalized to_wa -- so every touched row gets cleaned up
-- as a side effect, not just reassigned.
-- ============================================================

create or replace function wa_key(input text)
returns text
language sql
immutable
as $$
  select case
    when input is null or regexp_replace(input, '\D', '', 'g') = '' then ''
    when regexp_replace(input, '\D', '', 'g') like '0%'
      then '62' || substring(regexp_replace(input, '\D', '', 'g') from 2)
    when regexp_replace(input, '\D', '', 'g') like '8%'
      then '62' || regexp_replace(input, '\D', '', 'g')
    else regexp_replace(input, '\D', '', 'g')
  end;
$$;

create or replace function merge_member_wa(from_wa text, to_wa text)
returns void
language plpgsql
as $$
declare
  from_key text := wa_key(from_wa);
  to_key text := wa_key(to_wa);
begin
  if from_key = '' or to_key = '' then
    raise exception 'Nomor sumber/tujuan tidak valid.';
  end if;
  if from_key = to_key then
    raise exception 'Nomor sumber dan tujuan sama.';
  end if;
  if exists (select 1 from members where wa_key(wa) = from_key and pass_hash is not null)
     and exists (select 1 from members where wa_key(wa) = to_key and pass_hash is not null) then
    raise exception 'Kedua nomor sudah punya akun Balai Warga aktif sendiri-sendiri -- gabungkan manual dulu.';
  end if;

  update registrations set wa = to_key where wa_key(wa) = from_key;
  update quest_submissions set wa = to_key where wa_key(wa) = from_key;
  update board_messages set wa = to_key where wa_key(wa) = from_key;
  update suggestions set wa = to_key where wa_key(wa) = from_key;
  update barter_posts set wa = to_key where wa_key(wa) = from_key;
  update mading_journal_posts set wa = to_key where wa_key(wa) = from_key;

  delete from quest_likes ql
    where wa_key(ql.wa) = from_key
      and exists (select 1 from quest_likes q2 where wa_key(q2.wa) = to_key and q2.target_id = ql.target_id);
  update quest_likes set wa = to_key where wa_key(wa) = from_key;

  delete from suggestion_votes sv
    where wa_key(sv.wa) = from_key
      and exists (select 1 from suggestion_votes s2 where wa_key(s2.wa) = to_key and s2.suggestion_id = sv.suggestion_id);
  update suggestion_votes set wa = to_key where wa_key(wa) = from_key;

  if exists (select 1 from members where wa_key(wa) = from_key) then
    update members set wa = to_key where wa_key(wa) = from_key;
  end if;
end;
$$;

grant execute on function wa_key(text) to service_role;
grant execute on function merge_member_wa(text, text) to service_role;
