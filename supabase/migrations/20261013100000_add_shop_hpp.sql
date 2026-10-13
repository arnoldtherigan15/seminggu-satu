-- Menu "Shop" (sidebar sendiri, bukan sub-bagian Content & Programs) --
-- bukan toko online buat customer (itu udah pernah dicoba & dibatalin,
-- lihat 20261008100000_drop_shop.sql), ini murni ALAT HITUNG MODAL internal
-- buat Arnold:
--   1) shop_materials -- stok bahan baku yang DIA BELI buat dipake bikin
--      produk jualannya sendiri (mis. notebook kosongan, kertas, dst).
--      purchase_qty+price = basis hitung harga per satuan (mis. beli 100
--      lembar kertas Rp40.000 -> Rp400/lembar), stock_qty = sisa stok
--      SEKARANG (diupdate manual, BUKAN auto-deduct -- ini kalkulator
--      perencanaan, bukan sistem gudang/POS).
--   2) shop_products -- resep produk jualan: sejumlah bahan (dari
--      shop_materials, qty berapa yang kepake) + biaya lain yang nggak
--      butuh tracking stok (ongkos print, ongkos kerja, dst). `materials`
--      SENGAJA cuma nyimpen {materialId, qty} (BUKAN snapshot harga) --
--      beda dari pola "freeze harga saat itu" yang dipake di tempat lain
--      (mis. shop order items di plan yang dibatalin) karena ini KALKULATOR
--      PERENCANAAN yang harus ikut keupdate kalau harga bahan berubah,
--      bukan catatan transaksi historis yang harus tetep nunjukin harga
--      pas kejadian.
create table shop_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image text,
  link text,
  unit text not null default 'pcs',       -- label satuan bebas: lembar, pcs, gram, meter, dst
  purchase_qty numeric not null default 1, -- dapet berapa `unit` dari harga `price` di bawah
  price bigint not null default 0,         -- total harga beli buat purchase_qty di atas
  stock_qty numeric not null default 0,    -- sisa stok sekarang (manual)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  materials jsonb not null default '[]'::jsonb,    -- [{materialId, qty}]
  extra_costs jsonb not null default '[]'::jsonb,  -- [{label, amount}] -- biaya tanpa stok (ongkos print, kerja, dst)
  sell_price bigint,                                -- opsional, buat liat margin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shop_materials enable row level security;
alter table shop_products enable row level security;
-- Sengaja NGGAK ada policy publik -- cuma diakses lewat service role di
-- admin-api (requireAdminAuth), sama pola kayak semua tabel admin-only lain.
-- GRANT eksplisit -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (lihat fix_service_role_grants.sql).
grant all privileges on shop_materials, shop_products to service_role;

insert into storage.buckets (id, name, public)
values ('shop-material-photos', 'shop-material-photos', true)
on conflict (id) do nothing;
