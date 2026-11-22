-- ============================================================
-- Toko online pre-order (seminggusatu.com/shop)
--
-- Produk  : admin pilih mana yang tampil di toko, berat (buat ongkir),
--           catatan pre-order. Pre-order = NGGAK dibatasin stok.
-- Order   : order dari web masuk ke shop_orders yang sama (Order toko di
--           admin), plus alamat/ongkir JNE/bukti bayar/status/resi & token
--           buat halaman tracking pembeli.
-- Cache   : hasil RajaOngkir disimpen 30 hari (hemat kuota API) -- ongkir
--           per (asal, tujuan, kurir, berat dibulatin ke kg), dan hasil
--           pencarian alamat tujuan per kata kunci.
-- ============================================================

alter table shop_products
  add column if not exists show_in_shop boolean not null default false,
  add column if not exists weight_grams integer not null default 150,
  add column if not exists preorder_note text,
  add column if not exists shop_desc text;

alter table shop_orders
  add column if not exists source text,                    -- 'web' = dari toko online
  add column if not exists status text,                    -- lihat check di bawah (null = order manual lama)
  add column if not exists status_updated_at timestamptz,
  add column if not exists track_token uuid default gen_random_uuid(),
  add column if not exists ship_dest_id integer,
  add column if not exists ship_dest_label text,
  add column if not exists ship_service text,
  add column if not exists ship_cost bigint,
  add column if not exists ship_etd text,
  add column if not exists ship_weight_grams integer,
  add column if not exists awb text,                       -- nomor resi JNE
  add column if not exists payment_proof text,             -- "payment-proofs/<path>" (private)
  add column if not exists buyer_note text;

alter table shop_orders drop constraint if exists shop_orders_status_check;
alter table shop_orders add constraint shop_orders_status_check
  check (status is null or status in ('verifikasi', 'dibayar', 'diproses', 'dikirim', 'selesai', 'batal'));

alter table shop_orders drop constraint if exists shop_orders_channel_check;
alter table shop_orders add constraint shop_orders_channel_check
  check (channel is null or channel in ('instagram', 'threads', 'whatsapp', 'event', 'web', 'lainnya'));

create unique index if not exists shop_orders_track_token_idx on shop_orders (track_token);

create table if not exists shop_ongkir_cache (
  cache_key text primary key,           -- origin|dest|courier|kg
  options jsonb not null,
  fetched_at timestamptz not null default now()
);
create table if not exists shop_dest_cache (
  query text primary key,               -- kata kunci dinormalisasi (lowercase, spasi tunggal)
  results jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table shop_ongkir_cache enable row level security;
alter table shop_dest_cache enable row level security;
-- tabel baru WAJIB grant eksplisit ke service_role di project ini
grant all privileges on shop_ongkir_cache, shop_dest_cache to service_role;

-- Titik asal kirim: Jl. Bintaro Permai No.5, Pesanggrahan, Jakarta Selatan 12320
-- (id RajaOngkir hasil lookup sebelumnya, kecocokan sampai kode pos)
insert into app_config (key, value, updated_at) values
  ('SHOP_ORIGIN_ID', '17571', now()),
  ('SHOP_ORIGIN_LABEL', 'PESANGGRAHAN, PESANGGRAHAN, JAKARTA SELATAN, DKI JAKARTA, 12320', now())
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
