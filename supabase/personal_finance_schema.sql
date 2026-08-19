-- ============================================================
-- PERSONAL FINANCE (tab "Personal" di admin dashboard) -- catatan
-- keuangan PRIBADI Arnold, GA ADA hubungannya sama bisnis Seminggu
-- Satu. Numpang di admin dashboard yang sama (auth token admin yang
-- sama) biar ga perlu login/hosting terpisah -- makanya prefix tabel
-- "personal_" biar jelas kepisah dari tabel bisnis lainnya.
--
-- Saldo akun DIHITUNG (initial_balance + transaksi), bukan disimpen
-- sebagai kolom running balance -- lebih simpel & selalu akurat buat
-- skala pemakaian personal (bukan volume tinggi).
-- ============================================================

create table personal_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            text not null default 'cash',  -- 'cash' | 'bank' | 'ewallet' | 'other'
  initial_balance bigint not null default 0,      -- rupiah, integer (bukan desimal)
  color           text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table personal_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null,                      -- 'income' | 'expense'
  color       text,
  icon        text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table personal_transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null default current_date,
  type          text not null,                     -- 'income' | 'expense' | 'transfer'
  amount        bigint not null check (amount > 0), -- rupiah, integer
  account_id    uuid not null references personal_accounts(id),
  to_account_id uuid references personal_accounts(id),  -- diisi cuma kalau type='transfer'
  category_id   uuid references personal_categories(id), -- null kalau type='transfer'
  note          text,
  created_at    timestamptz not null default now()
);
create index personal_transactions_date_idx on personal_transactions (date desc);
create index personal_transactions_account_idx on personal_transactions (account_id);
create index personal_transactions_category_idx on personal_transactions (category_id);

alter table personal_accounts enable row level security;
alter table personal_categories enable row level security;
alter table personal_transactions enable row level security;
-- Sengaja NGGAK ada policy publik apapun -- cuma bisa diakses lewat
-- service role di edge function personal-api (sama pola kayak semua
-- tabel admin-only lain di schema.sql ini), dijaga requireAdminAuth().

-- Kategori awal biar nggak mulai dari kosong melompong -- boleh
-- diedit/dihapus/nambah lewat tab Kategori kapan aja.
insert into personal_categories (name, type, icon) values
  ('Gaji', 'income', 'cash'),
  ('Bonus/THR', 'income', 'star'),
  ('Lainnya', 'income', 'plus'),
  ('Makan & Minum', 'expense', 'cup'),
  ('Transport', 'expense', 'geo'),
  ('Belanja', 'expense', 'cart'),
  ('Tagihan/Langganan', 'expense', 'receipt'),
  ('Hiburan', 'expense', 'stars'),
  ('Kesehatan', 'expense', 'heart'),
  ('Lainnya', 'expense', 'plus');
