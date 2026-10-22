-- Foto produk jualan (Kalkulasi HPP) -- sama pola kayak shop_materials.image,
-- biar produk keliatan kayak apa di list, nggak cuma teks.
alter table shop_products add column image text;

-- QRIS per batch -- gambar QR statis yang Arnold generate sendiri lewat
-- app bank/e-wallet-nya, tinggal diupload di tab Peserta Event -- Order
-- Toko. Murni penyimpanan + tampilan, bukan QR yang di-generate sistem
-- (beda dari shop_products.sell_token yang dipakai buat QR scan-to-sell).
alter table batches add column qris_image text;

insert into storage.buckets (id, name, public)
values ('shop-product-photos', 'shop-product-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('batch-qris-photos', 'batch-qris-photos', true)
on conflict (id) do nothing;
