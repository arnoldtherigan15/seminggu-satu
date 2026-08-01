-- ============================================================
-- Cron baru: bersihin foto check-in journal yang udah lewat bulan
-- (Storage aja yang dibersihin, note/tanggal/streak TETEP kesimpen).
--
-- BEDA dari schedule_cron_jobs.sql (yang cuma prod-only karena butuh
-- secret Telegram/OneSignal) -- job ini NGGAK butuh secret apa-apa,
-- jadi jalanin di KEDUA project: dev DULU baru production.
--
-- Jam ditulis UTC (Postgres cron pakai UTC) -- WIB = UTC+7:
--   03:00 WIB = 20:00 UTC (hari sebelumnya)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- BLOK 1: jalanin di project DEV (jynlksrtucububtqqpav) ----------
select cron.schedule(
  'cleanup-checkin-photos',
  '0 20 * * *',
  $$
  select net.http_post(
    url := 'https://jynlksrtucububtqqpav.supabase.co/functions/v1/cron-cleanup-checkin-photos',
    headers := jsonb_build_object('apikey', 'sb_publishable_u6njfYcniKbeXutghUmKjw_LciOlZEs', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- ---------- BLOK 2: jalanin di project PRODUCTION (anztympwvfjgkpycgdvm) ----------
-- (skip blok ini kalau lagi di SQL Editor dev, dan sebaliknya)
select cron.schedule(
  'cleanup-checkin-photos',
  '0 20 * * *',
  $$
  select net.http_post(
    url := 'https://anztympwvfjgkpycgdvm.supabase.co/functions/v1/cron-cleanup-checkin-photos',
    headers := jsonb_build_object('apikey', 'sb_publishable_u-88r-vtj5VE6D9cgz6oZg_34osylPt', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Cek job udah terjadwal (jalanin di project yang sama abis select cron.schedule di atas)
select jobid, jobname, schedule, active from cron.job order by jobname;
