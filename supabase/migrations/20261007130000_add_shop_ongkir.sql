-- ============================================================
-- Fase 2 Toko: ongkir beneran via RajaOngkir (bukan placeholder lagi).
--
-- 1. shop_products butuh berat/unit buat dihitung total berat keranjang
--    (server yang hitung ulang dari DB, bukan percaya angka dari client --
--    sama prinsipnya kayak harga/stok, jangan pernah percaya client buat
--    angka yang nentuin duit).
-- 2. Titik asal (origin) pengiriman Arnold disimpen di app_config (generic
--    key-value yang udah ada, sama pola kayak WORKSHOPS_JSON dkk) -- dicari
--    SEKALI lewat RajaOngkir destination search, idnya dipakai terus buat
--    semua kalkulasi ongkir selanjutnya.
-- ============================================================

alter table shop_products add column weight_grams integer not null default 150;

-- Berat REALISTIS per unit produk (bukan sekadar default generik) --
-- decopaper/stiker ringan (amplop kecil), kit/stamp lebih berat (ada kayu/buku).
update shop_products set weight_grams = 300 where slug = 'pastel-dream-journaling-kit';
update shop_products set weight_grams = 10  where slug in ('decopaper-vintage-diary-01', 'decopaper-botanical-leaf-3');
update shop_products set weight_grams = 80  where slug = 'washi-tape-pastel-set';
update shop_products set weight_grams = 250 where slug = 'wooden-stamp-ink-pad-set';
update shop_products set weight_grams = 300 where slug = 'grid-dot-memo-pad';
update shop_products set weight_grams = 20  where slug = 'vintage-aesthetic-sticker-pack';

-- Titik asal pengiriman -- Jl. Bintaro Permai No.5, Pesanggrahan, Jakarta
-- Selatan 12320. Id ini hasil lookup RajaOngkir destination search
-- (kecocokan persis sampai kode pos), BUKAN ditebak.
insert into app_config (key, value, updated_at) values
  ('SHOP_ORIGIN_ID', '17571', now()),
  ('SHOP_ORIGIN_LABEL', 'PESANGGRAHAN, PESANGGRAHAN, JAKARTA SELATAN, DKI JAKARTA, 12320', now())
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
