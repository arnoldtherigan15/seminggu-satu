-- ============================================================
-- Seeding config workshop "Side by Side" ke WORKSHOPS_JSON, biar Arnold
-- nggak perlu isi form Config manual dari nol -- tinggal cek & sunting
-- field yang belum lengkap (openDate/closeDate/eventDate/workshopDate
-- masih KOSONG karena tanggal event belum dikasih tau -- WAJIB diisi
-- sebelum enabled diaktifkan, kalau nggak halaman publiknya bakal
-- nampilin "Memuat tanggal..." selamanya).
--
-- Aman dijalanin ulang (idempotent) -- kalau id 'side-by-side' udah ada,
-- nggak nambah duplikat.
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

update app_config
set
  value = (
    (value::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'side-by-side',
      'name', 'Side by Side',
      'description', 'Parent & Kid Journal Playdate — journaling bareng si kecil, abadikan momen berharga kalian berdua di satu jurnal.',
      'enabled', false,
      'isDisplay', false,
      'isPrintPhoto', true,
      'openDate', '',
      'closeDate', '',
      'normalPrice', 285000,
      'earlyBirdPrice', 255000,
      'earlyBirdDueDate', '',
      'earlyBirdMaxCount', 3,
      'maxQuota', 15,
      'eventDate', '',
      'workshopDate', '',
      'workshopTime', '10.00 - 12.30',
      'locationName', 'Kopitagram Centang Biru, Ampera Jakarta Selatan',
      'mapsLink', 'https://maps.app.goo.gl/qt4cmrggjrDQHxbu7',
      'whatsappGroupLink', 'https://chat.whatsapp.com/F2J0yH2ub4IL5h5I4Roh6O?s=cl&p=i&mlu=4&amv=0',
      'bankName', '',
      'bankAccountNumber', '',
      'bankAccountHolder', '',
      'icon', 'users',
      'path', 'side-by-side/index.html'
    ))
  )::text,
  updated_at = now()
where key = 'WORKSHOPS_JSON'
  and not exists (
    select 1 from jsonb_array_elements(value::jsonb) e where e->>'id' = 'side-by-side'
  );

-- Cek hasilnya
select jsonb_pretty(e) from app_config, jsonb_array_elements(value::jsonb) e
where key = 'WORKSHOPS_JSON' and e->>'id' = 'side-by-side';
