-- ============================================================
-- Agenda pribadi Arnold (Kalender admin) -- kegiatan DI LUAR event
-- Seminggu Satu (kerjaan lain, janji, dsb). Event Seminggu Satu sendiri
-- nggak disimpen di sini: diambil langsung dari tabel batches.
-- Diakses cuma lewat personal-api (service role, khusus super admin),
-- sama pola kayak tabel personal_* lain.
-- ============================================================

create table if not exists personal_agenda (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  start_date  date not null,
  end_date    date,                       -- null = cuma 1 hari
  start_time  time,                       -- null = seharian
  end_time    time,
  location    text not null default '',
  note        text not null default '',
  color       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint personal_agenda_date_order check (end_date is null or end_date >= start_date)
);

-- query kalender selalu per rentang tanggal
create index if not exists personal_agenda_start_idx on personal_agenda (start_date);

alter table personal_agenda enable row level security;
-- Sengaja NGGAK ada policy publik (lihat personal_notes).
grant all privileges on personal_agenda to service_role;
