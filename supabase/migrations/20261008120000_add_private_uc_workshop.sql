-- ============================================================
-- Event baru: "Upcycle Journal Private Session" (/private-uc) -- sesi
-- private kecil (kuota default 3), ikut hitungan loyalty & bisa aktivasi
-- warga SAMA PERSIS kayak workshop berbayar lainnya (cukup bukan
-- "journaling-date" di `registrations.workshop_type` -- lihat
-- _shared/queries.ts loyaltyMembers(), nggak butuh perubahan kode apa pun).
--
-- Config (type-level, dipakai Prep/admin UI & fallback kalau batch belum
-- override) + 1 batch awal ("Batch 1") dengan harga/kuota default yang
-- diminta. Batch SENGAJA nggak diisi event_date/lokasi/dll -- Arnold isi
-- sendiri lewat admin > Config > Batch Detail sebelum link-nya disebar.
-- ============================================================

update app_config
set value = (
  value::jsonb || jsonb_build_array(jsonb_build_object(
    'id', 'private-uc',
    'name', 'Upcycle Journal Private Session',
    'description', 'Sesi journaling private & intimate, maksimal 3 orang per sesi.',
    'icon', 'lock',
    'path', 'private-uc/index.html',
    'enabled', true,
    'isDisplay', false,
    'isPrintPhoto', true,
    'normalPrice', 135000,
    'earlyBirdPrice', null,
    'earlyBirdDueDate', '',
    'earlyBirdMaxCount', null,
    'maxQuota', 3,
    'openDate', '', 'closeDate', '', 'eventDate', '',
    'workshopDate', '', 'workshopTime', '', 'locationName', '', 'mapsLink', '',
    'whatsappGroupLink', '',
    'bankName', '', 'bankAccountNumber', '', 'bankAccountHolder', ''
  ))
)::text,
updated_at = now()
where key = 'WORKSHOPS_JSON'
  and not (value::jsonb @> '[{"id":"private-uc"}]'::jsonb); -- idempotent kalau migration ini kejalan 2x

insert into batches (workshop_type, label, active, max_quota, normal_price)
select 'private-uc', 'Batch 1', true, 3, 135000
where not exists (select 1 from batches where workshop_type = 'private-uc');
