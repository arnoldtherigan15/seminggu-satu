-- "Upcycle Journal Private Session" itu event PUBLIC (siapa aja bisa liat &
-- daftar, bukan invite-only kayak Journaling Date Intimate) -- cuma namanya
-- doang yang "Private" (karena sesinya kecil/intimate, kuota 3 orang).
-- isDisplay:false kemarin sengaja dipasang nyontek pola Journaling Date,
-- ternyata salah asumsi -- flip ke true biar muncul di home & /links/.
update app_config
set value = (
  (
    select jsonb_agg(
      case when elem->>'id' = 'private-uc' then jsonb_set(elem, '{isDisplay}', 'true'::jsonb) else elem end
    )
    from jsonb_array_elements(value::jsonb) elem
  )
)::text,
updated_at = now()
where key = 'WORKSHOPS_JSON';
