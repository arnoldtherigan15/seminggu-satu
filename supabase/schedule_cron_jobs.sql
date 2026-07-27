-- ============================================================
-- Fase 6 — Jadwalin 3 cron job (dipanggil via pg_cron + pg_net, native
-- Postgres extension, gratis di semua tier Supabase).
--
-- Jalanin ini di SQL Editor project PRODUCTION aja (bukan dev -- dev
-- sengaja nggak diisi secret Telegram/OneSignal, jadi crons di dev
-- nggak ada gunanya & cuma nyampah).
--
-- Jam ditulis dalam UTC (Postgres cron pakai UTC) -- WIB = UTC+7:
--   09:00 WIB = 02:00 UTC, 08:00 WIB = 01:00 UTC
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Ultah warga -- tiap hari jam 09:00 WIB (port dari dailyBirthdayPush)
select cron.schedule(
  'daily-birthday-push',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://anztympwvfjgkpycgdvm.supabase.co/functions/v1/cron-daily-birthday-push',
    headers := jsonb_build_object('apikey', 'sb_publishable_u-88r-vtj5VE6D9cgz6oZg_34osylPt', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- 2) Reminder check-in mingguan -- tiap Minggu jam 09:00 WIB (port dari weeklyCheckinPush)
select cron.schedule(
  'weekly-checkin-push',
  '0 2 * * 0',
  $$
  select net.http_post(
    url := 'https://anztympwvfjgkpycgdvm.supabase.co/functions/v1/cron-weekly-checkin-push',
    headers := jsonb_build_object('apikey', 'sb_publishable_u-88r-vtj5VE6D9cgz6oZg_34osylPt', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- 3) Reminder event H-1/hari-H ke Telegram admin -- tiap hari jam 08:00 WIB (port dari sendDailyReminder)
select cron.schedule(
  'daily-event-reminder',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://anztympwvfjgkpycgdvm.supabase.co/functions/v1/cron-daily-reminder',
    headers := jsonb_build_object('apikey', 'sb_publishable_u-88r-vtj5VE6D9cgz6oZg_34osylPt', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Cek semua job udah terjadwal (jalanin abis 3 select cron.schedule di atas)
select jobid, jobname, schedule, active from cron.job order by jobname;
