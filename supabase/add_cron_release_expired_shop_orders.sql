-- ============================================================
-- Cron baru: lepas reservasi stok buat pesanan Toko yang "pending_review"
-- tapi udah lewat reserved_until (nggak pernah diapprove/direject admin).
--
-- NGGAK butuh secret apa-apa (sama kayak cleanup foto), jalanin di KEDUA
-- project: dev DULU baru production -- paste di SQL Editor masing-masing,
-- jalanin blok yang sesuai (skip blok yang bukan punya project itu).
--
-- Jam ditulis UTC (Postgres cron pakai UTC) -- WIB = UTC+7:
--   05:00 WIB = 22:00 UTC (hari sebelumnya)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- BLOK 1: jalanin di project DEV (jynlksrtucububtqqpav) ----------
select cron.schedule(
  'release-expired-shop-orders',
  '0 22 * * *',
  $$
  select net.http_post(
    url := 'https://jynlksrtucububtqqpav.supabase.co/functions/v1/cron-release-expired-shop-orders',
    headers := jsonb_build_object('apikey', 'sb_publishable_u6njfYcniKbeXutghUmKjw_LciOlZEs', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- ---------- BLOK 2: jalanin di project PRODUCTION (anztympwvfjgkpycgdvm) ----------
select cron.schedule(
  'release-expired-shop-orders',
  '0 22 * * *',
  $$
  select net.http_post(
    url := 'https://anztympwvfjgkpycgdvm.supabase.co/functions/v1/cron-release-expired-shop-orders',
    headers := jsonb_build_object('apikey', 'sb_publishable_u-88r-vtj5VE6D9cgz6oZg_34osylPt', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Cek job udah terjadwal (jalanin di project yang sama abis select cron.schedule di atas)
select jobid, jobname, schedule, active from cron.job order by jobname;
