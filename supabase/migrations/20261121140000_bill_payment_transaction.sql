-- ============================================================
-- Rutin (tagihan berulang): tombol "Bayar" sekarang sekalian nyatet
-- pengeluarannya. transaction_id = transaksi yang kebikin, biar pas
-- "batal bayar" transaksinya ikut kehapus (nggak dobel/nyangkut).
-- ============================================================

alter table personal_bill_payments
  add column if not exists transaction_id uuid references personal_transactions(id) on delete set null;

create index if not exists personal_bill_payments_tx_idx on personal_bill_payments (transaction_id);
