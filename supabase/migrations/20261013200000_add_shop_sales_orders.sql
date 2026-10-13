-- Lanjutan Shop: dari sekadar kalkulator HPP (shop_products) jadi bisa
-- NYETOK produk jadi, nge-TRACK keuntungan, jual via SCAN QR (ngurangin
-- stok otomatis), dan bikin ORDER per pembeli di suatu event/batch +
-- invoice PDF.
--
-- shop_products dapet 2 kolom baru:
--   stock_qty   -- stok produk JADI yang siap dijual (beda dari stok bahan
--                  baku di shop_materials -- ini hasil produksi, diupdate
--                  manual pas Arnold selesai bikin batch produk baru, atau
--                  otomatis berkurang tiap ada penjualan).
--   sell_token  -- uuid rahasia dipakein buat QR "scan buat jual" (link
--                  publik /shop-sell/?t=<token>, scan kamera HP -> buka
--                  halaman situ, bukan perlu login admin). Di-generate
--                  sekali per produk, NGGAK pernah berubah (kalau berubah,
--                  QR fisik/tercetak yang udah ada jadi basi).
alter table shop_products add column stock_qty numeric not null default 0;
alter table shop_products add column sell_token uuid not null default gen_random_uuid();
create unique index shop_products_sell_token_idx on shop_products (sell_token);

-- Order = satu "tab" belanja per pembeli di satu event/batch (atau lepas,
-- buat pembeli umum di luar event). registration_id OPSIONAL -- order bisa
-- ditautkan ke pendaftar beneran (biar gampang isi nama/WA otomatis), ATAU
-- nama manual (walk-in, bukan peserta workshop) kalau registration_id null.
create table shop_orders (
  id uuid primary key default gen_random_uuid(),
  workshop_type text,
  batch_id uuid references batches(id) on delete set null,
  registration_id uuid references registrations(id) on delete set null,
  buyer_name text not null,
  buyer_wa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shop_orders_batch_idx on shop_orders (batch_id);

-- Satu baris = satu KEJADIAN JUAL (bukan cuma "line item" di order) --
-- order_id NULL berarti ini jualan langsung lewat scan QR (nggak terikat
-- order/pembeli manapun), order_id keisi berarti ini salah satu item di
-- invoice/order tertentu. unit_sell_price & unit_hpp SENGAJA di-SNAPSHOT
-- (bukan dihitung live kayak shop_products) -- ini CATATAN TRANSAKSI
-- historis, keuntungan yang udah kejadian HARUS tetap nunjukin angka pas
-- saat itu, walau HPP produk berubah belakangan (beda filosofi dari
-- shop_products.materials yang sengaja live, lihat komentar di situ).
create table shop_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references shop_products(id) on delete cascade,
  qty numeric not null,
  unit_sell_price bigint not null,
  unit_hpp bigint not null,
  order_id uuid references shop_orders(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index shop_sales_product_idx on shop_sales (product_id);
create index shop_sales_order_idx on shop_sales (order_id);

alter table shop_orders enable row level security;
alter table shop_sales enable row level security;
-- Sengaja NGGAK ada policy publik buat shop_orders/shop_sales lewat RLS --
-- halaman scan-QR publik (shop-sell Edge Function) & admin-api SAMA-SAMA
-- pakai service role (bypass RLS), bedanya cuma endpoint publik itu
-- divalidasi via sell_token (bukan session admin). GRANT eksplisit --
-- tabel baru di project ini nggak reliably kewarisin default-privileges
-- grant (lihat fix_service_role_grants.sql).
grant all privileges on shop_orders, shop_sales to service_role;
