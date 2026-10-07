-- ============================================================
-- Toko (Journaling Kit & Stationery) -- jualan online, pintu masuk KEDUA
-- ke komunitas warga selain ikut event berbayar langsung (yang udah ada).
--
-- shop_products/shop_product_variants -- katalog, stok per varian.
-- shop_kit_sessions -- jadwal Zoom buat opsi bundle "Kit + Akses Komunitas"
--   (dibikin terpisah dari `batches`, bukan numpang di situ -- sesi kit nggak
--   butuh mesin merge Config/harga-tier/open-close-date se-kompleks batch
--   workshop, cukup label + jadwal + kuota).
-- shop_orders/shop_order_items -- pesanan, SNAPSHOT nama & harga produk di
--   item (bukan join live ke shop_products) -- biar harga di pesanan LAMA
--   nggak ikut berubah kalau produknya diedit belakangan (kelas bug yang
--   sama persis kayak alasan _shared/batch-merge.ts ada).
-- community_access_grants -- jembatan ke isMemberWa()/loyaltyMembers():
--   WA yang beli bundle & disetujui adminnya dianggap qualifying paid event
--   SAMA kayak abis ikut workshop berbayar, TANPA numpang insert row palsu
--   ke `registrations` (yang bakal ngotorin list/CSV/Prep admin dgn tipe
--   yang bukan event beneran).
-- ============================================================

create table shop_products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category    text not null,          -- "kit" | "decopaper" | "washitape" | "stamp" | "memopad" | "sticker" | dst
  description text not null default '',
  image_url   text not null default '',
  active      boolean not null default true,
  base_price  integer not null default 0,    -- Rupiah, varian bisa override
  is_kit      boolean not null default false, -- true cuma buat produk Journaling Kit
  created_at  timestamptz not null default now()
);

create table shop_product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references shop_products(id) on delete cascade,
  label          text not null,              -- "Old Newspaper", "Eucalyptus Green", dst
  price_override integer,                    -- null = ikut shop_products.base_price
  stock_qty      integer,                    -- null = made-to-order/unlimited (selalu pre-order)
  is_preorder    boolean not null default false,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index shop_product_variants_product_idx on shop_product_variants (product_id);

create table shop_kit_sessions (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,          -- "Batch #4"
  session_at  timestamptz,
  zoom_link   text not null default '',
  max_quota   integer,                -- null = nggak dibatasin
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table shop_orders (
  id                        uuid primary key default gen_random_uuid(),
  order_code                text unique not null,
  customer_wa               text not null,
  customer_name             text not null,
  shipping_address          jsonb not null default '{}',   -- {recipient, phone, address, subdistrict_id, city, province, postal_code}
  courier                   text not null default 'jne',
  shipping_service          text not null default '',
  shipping_cost             integer not null default 0,
  subtotal                  integer not null default 0,
  total                     integer not null default 0,
  status                    text not null default 'pending_payment',
  -- pending_payment -> pending_review -> approved -> shipped -> completed
  --                                   \-> rejected          (stok dilepas)
  -- pending_payment juga bisa -> expired (cron, stok dilepas) kalau lewat reserved_until
  payment_proof_url         text,
  reject_reason             text,
  tracking_number           text,
  kit_session_id            uuid references shop_kit_sessions(id),
  includes_community_bundle boolean not null default false,
  reserved_until            timestamptz,
  created_at                timestamptz not null default now(),
  reviewed_at               timestamptz,
  reviewed_by               text,
  shipped_at                timestamptz
);
create index shop_orders_wa_idx on shop_orders (customer_wa);
create index shop_orders_status_idx on shop_orders (status);

create table shop_order_items (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references shop_orders(id) on delete cascade,
  product_id              uuid not null references shop_products(id),
  variant_id              uuid references shop_product_variants(id),
  product_name_snapshot   text not null,
  variant_label_snapshot  text not null default '',
  unit_price_snapshot     integer not null,
  quantity                integer not null default 1
);
create index shop_order_items_order_idx on shop_order_items (order_id);

create table community_access_grants (
  wa         text primary key,
  source     text not null default 'shop_kit_bundle',
  order_id   uuid references shop_orders(id),
  granted_at timestamptz not null default now()
);

alter table shop_products enable row level security;
alter table shop_product_variants enable row level security;
alter table shop_kit_sessions enable row level security;
alter table shop_orders enable row level security;
alter table shop_order_items enable row level security;
alter table community_access_grants enable row level security;

grant all privileges on shop_products, shop_product_variants, shop_kit_sessions,
  shop_orders, shop_order_items, community_access_grants to service_role;

-- Foto produk -- public, sama pola kayak menu-photos/quest-photos.
insert into storage.buckets (id, name, public)
values ('shop-product-photos', 'shop-product-photos', true)
on conflict (id) do nothing;
