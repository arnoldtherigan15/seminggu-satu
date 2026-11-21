-- ============================================================
-- Pengingat keuangan lewat bot Telegram -- tiap hari 19.00 WIB (12.00 UTC):
--  - tagihan rutin yang jatuh tempo BESOK & belum lunas
--  - Minggu malam: rekap singkat minggu ini
-- URL fungsi & kunci cron dibaca dari personal_settings (diisi otomatis
-- sama personal-api pas halaman Keuangan dibuka), jadi file ini sama persis
-- buat project dev & production dan nggak ada secret yang ke-commit.
-- Kalau setting-nya belum ada, job-nya diem (nggak manggil apa-apa).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'finance-telegram-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := (select value from public.personal_settings where key = 'functions_base') || '/functions/v1/cron-finance-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select value from public.personal_settings where key = 'cron_key')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from public.personal_settings where key = 'cron_key')
    and exists (select 1 from public.personal_settings where key = 'functions_base');
  $$
);
