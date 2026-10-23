-- Nandain kapan sebuah shop_orders self-checkout "resmi" di-checkout (tombol
-- "WA Arnold untuk Konfirmasi" ditekan) -- dipake shop-bill buat bedain
-- tagihan yang MASIH dibangun (halaman checkout, bisa diedit) vs yang UDAH
-- di-checkout (halaman invoice read-only kalau link-nya dibuka lagi).
alter table shop_orders add column checked_out_at timestamptz;
