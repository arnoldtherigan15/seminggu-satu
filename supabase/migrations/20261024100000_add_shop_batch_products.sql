-- "Produk yang Dibawa" per event (batch) -- Arnold nyentang produk apa aja
-- yang dia bawa ke satu event + jumlahnya, terus pembeli cukup scan SATU QR
-- event (/shop-bill/?e=<batch_id>) dan milih sendiri dari daftar itu.
-- Gantiin alur lama "scan QR tiap produk satu-satu + pilih event sendiri pas
-- checkout" yang ternyata bikin bingung banyak pembeli.
--
-- qty = jumlah yang DIBAWA ke event itu. Sisa di event = qty dikurangi
-- shop_sales dari order yang batch_id-nya batch ini (dihitung live, nggak
-- disimpen). Stok gudang (shop_products.stock_qty) tetep dikurangin kayak
-- biasa tiap ada yang kebeli.
create table shop_batch_products (
  batch_id uuid not null references batches(id) on delete cascade,
  product_id uuid not null references shop_products(id) on delete cascade,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  primary key (batch_id, product_id)
);
alter table shop_batch_products enable row level security;

-- GRANT eksplisit -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (lihat fix_service_role_grants.sql).
grant all privileges on shop_batch_products to service_role;
