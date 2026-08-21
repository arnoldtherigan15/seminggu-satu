-- ============================================================
-- Foto/avatar per akun (Personal Finance) -- biar bisa ganti gambar
-- akunnya (mis. logo bank/e-wallet) dari admin, bukan cuma icon
-- generik. Bucket public sama pola kayak cost-item-photos/
-- recommendation-photos.
-- ============================================================
alter table personal_accounts add column photo_url text;

insert into storage.buckets (id, name, public)
values ('account-photos', 'account-photos', true)
on conflict (id) do nothing;
