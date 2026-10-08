-- ============================================================
-- Toko (Journaling Kit & Stationery) dibatalkan -- Arnold mutusin nggak
-- jadi dibikin. Bersihin semua skema/data/config yang udah sempat dibuat
-- (Phase 1 + Phase 2 ongkir), balik ke kondisi sebelum fitur ini ada.
-- ============================================================

drop function if exists reserve_shop_stock(uuid, integer);
drop function if exists release_shop_stock(uuid, integer);

drop table if exists community_access_grants;
drop table if exists shop_order_items;
drop table if exists shop_orders;
drop table if exists shop_kit_sessions;
drop table if exists shop_product_variants;
drop table if exists shop_products;

delete from app_config where key in ('SHOP_ORIGIN_ID', 'SHOP_ORIGIN_LABEL');

-- Bucket "shop-product-photos" SENGAJA dibiarin (direct SQL delete ke
-- storage.objects/storage.buckets diblokir -- harus lewat Storage API).
-- Isinya cuma beberapa foto test kecil, nggak masalah ditinggal kosongan.
