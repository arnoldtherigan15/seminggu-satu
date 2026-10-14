-- Catatan per item (mis. "Merah 1, Kuning 3" buat varian warna/jenis yang
-- nggak kepisah jadi produk sendiri-sendiri di Stok Produk) -- biar Arnold
-- gampang nge-track siapa pesen varian apa, muncul juga di invoice PDF.
alter table shop_sales add column notes text;

-- Alamat pengiriman OPSIONAL + flag COD (ketemu langsung, nggak perlu
-- alamat) per order. Keduanya opsional/independen -- admin yang nentuin
-- mana yang relevan pas isi info pembeli.
alter table shop_orders add column delivery_address text;
alter table shop_orders add column is_cod boolean not null default false;
