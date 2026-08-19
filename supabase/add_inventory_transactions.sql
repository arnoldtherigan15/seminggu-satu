-- ============================================================
-- Riwayat stok per item (cost_items) -- "masih ada sisa berapa" dijawab
-- dari LOG transaksi (beli/pakai/koreksi), bukan angka tunggal yang
-- diedit manual -- sama pola kayak saldo akun & progress target
-- tabungan di Personal Finance (dihitung dari histori, selalu akurat).
-- ============================================================
create table inventory_transactions (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references cost_items(id) on delete cascade,
  type          text not null,       -- 'beli' | 'pakai' | 'adjust'
  qty           integer not null,    -- selalu positif buat beli/pakai; adjust boleh negatif (koreksi turun)
  date          date not null default current_date,
  workshop_type text,                -- opsional -- link ke workshop yang makai (relevan kalau type='pakai')
  note          text,
  created_at    timestamptz not null default now()
);
create index inventory_transactions_item_idx on inventory_transactions (item_id);

alter table inventory_transactions enable row level security;
-- GRANT eksplisit -- lihat fix_service_role_grants.sql, tabel baru ga otomatis
-- ke-grant ke service_role kalau dibikin lewat sesi/role yang beda.
grant all privileges on inventory_transactions to service_role;
