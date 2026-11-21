-- ============================================================
-- Pengaturan pribadi (key-value) yang SENSITIF -- mis. token bot
-- Telegram (disimpan terenkripsi), secret webhook, chat id yang
-- di-link. Sengaja BUKAN di app_config (itu dibaca halaman publik).
-- Cuma diakses service role lewat edge function.
-- ============================================================

create table if not exists personal_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

alter table personal_settings enable row level security;
-- Sengaja NGGAK ada policy apa pun -> anon/authenticated nggak bisa baca.
grant all privileges on personal_settings to service_role;
