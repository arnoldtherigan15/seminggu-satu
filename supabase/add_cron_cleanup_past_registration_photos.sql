-- ============================================================
-- Cron baru: bersihin foto pendaftaran (bukti bayar + foto karya/charm/
-- print) buat batch yang event_date-nya udah lewat (H+1) -- foto ini
-- udah nggak kepake lagi abis eventnya kelar.
--
-- NGGAK butuh secret apa-apa (sama kayak cleanup foto check-in), jadi
-- jalanin di KEDUA project: dev DULU baru production.
--
-- Jam ditulis UTC (Postgres cron pakai UTC) -- WIB = UTC+7:
--   04:00 WIB = 21:00 UTC (hari sebelumnya)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- BLOK 1: jalanin di project DEV (jynlksrtucububtqqpav) ----------
select cron.schedule(
  'cleanup-past-registration-photos',
  '0 21 * * *',
  $$
  select net.http_post(
    url := 'https://jynlksrtucububtqqpav.supabase.co/functions/v1/cron-cleanup-past-registration-photos',
    headers := jsonb_build_object('apikey', 'sb_publishable_u6njfYcniKbeXutghUmKjw_LciOlZEs', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- ---------- BLOK 2: jalanin di project PRODUCTION (anztympwvfjgkpycgdvm) ----------
-- (skip blok ini kalau lagi di SQL Editor dev, dan sebaliknya)
select cron.schedule(
  'cleanup-past-registration-photos',
  '0 21 * * *',
  $$
  select net.http_post(
    url := 'https://anztympwvfjgkpycgdvm.supabase.co/functions/v1/cron-cleanup-past-registration-photos',
    headers := jsonb_build_object('apikey', 'sb_publishable_u-88r-vtj5VE6D9cgz6oZg_34osylPt', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Cek job udah terjadwal (jalanin di project yang sama abis select cron.schedule di atas)
select jobid, jobname, schedule, active from cron.job order by jobname;
