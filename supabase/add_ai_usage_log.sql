-- ============================================================
-- Log pemanggilan Gemini API (fitur Impor AI di Personal Finance) --
-- biar bisa ditampilin "sisa berapa kali lagi hari ini" di UI, since
-- free tier Gemini ada limit harian. usage_date dihitung di zona
-- WIB (Asia/Jakarta) biar batas "hari ini"-nya sesuai jam Arnold,
-- bukan UTC.
-- ============================================================
create table ai_usage_log (
  id          uuid primary key default gen_random_uuid(),
  usage_date  date not null default ((now() at time zone 'Asia/Jakarta')::date),
  created_at  timestamptz not null default now()
);
create index ai_usage_log_date_idx on ai_usage_log (usage_date);

alter table ai_usage_log enable row level security;
grant all privileges on ai_usage_log to service_role;
