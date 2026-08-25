-- ============================================================
-- Hutang/liability (Personal > Financial Tracker) -- mirror pola
-- persis dari personal_savings_goals/contributions (lihat
-- add_personal_savings_goals.sql): sisa hutang DIHITUNG dari
-- principal_amount - sum(payments), bukan angka tunggal yang diedit
-- langsung, biar ada riwayat "kapan bayar berapa" yang konkret --
-- payment amount boleh negatif (nambah hutang baru, mis. kepake lagi
-- kartu kreditnya), sama kayak withdrawal di savings contributions.
-- ============================================================
create table personal_liabilities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  principal_amount bigint not null check (principal_amount > 0),
  icon             text,
  due_date         date,
  archived         boolean not null default false,
  created_at       timestamptz not null default now()
);

create table personal_liability_payments (
  id            uuid primary key default gen_random_uuid(),
  liability_id  uuid not null references personal_liabilities(id) on delete cascade,
  amount        bigint not null,  -- positif = bayar (kurangin hutang), negatif = nambah hutang
  date          date not null default current_date,
  note          text,
  created_at    timestamptz not null default now()
);
create index personal_liability_payments_liability_idx on personal_liability_payments (liability_id);

alter table personal_liabilities enable row level security;
alter table personal_liability_payments enable row level security;
grant all privileges on personal_liabilities, personal_liability_payments to service_role;
