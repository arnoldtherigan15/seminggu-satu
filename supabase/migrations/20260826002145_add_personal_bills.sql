-- ============================================================
-- Tracker tagihan bulanan berulang (KPR, internet, parkir, dst) --
-- checklist "udah dibayar bulan ini?" yang OTOMATIS ke-reset tiap
-- periode baru (nggak butuh cron): status "paid" dihitung dari ada/
-- nggaknya baris personal_bill_payments buat (bill, periode saat ini),
-- bukan flag yang manual di-reset. Ini MURNI catatan/checklist --
-- SENGAJA nggak nyentuh personal_transactions (bukan pengeluaran).
-- ============================================================

create table personal_bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount bigint not null default 0,
  reset_day integer not null default 25, -- tanggal reset checklist tiap bulan (1-28)
  icon text not null default 'receipt',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table personal_bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references personal_bills(id) on delete cascade,
  period_key text not null, -- 'YYYY-MM', bulan mulainya periode (lihat reset_day)
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (bill_id, period_key)
);
create index personal_bill_payments_bill_idx on personal_bill_payments (bill_id);

alter table personal_bills enable row level security;
alter table personal_bill_payments enable row level security;
grant all privileges on personal_bills, personal_bill_payments to service_role;
