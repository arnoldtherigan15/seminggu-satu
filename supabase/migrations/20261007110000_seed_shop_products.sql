-- ============================================================
-- Seed katalog awal Toko biar nggak kosong pas pertama kali dibuka --
-- Arnold tinggal edit/hapus/nambahin dari admin (Toko > Produk). Nama/harga
-- dasar diadaptasi dari mockup referensi, disesuaikan ke skema beneran
-- (varian + stok per varian, bukan field lepas).
-- ============================================================

DO $$
DECLARE
  v_kit uuid;
  v_deco1 uuid;
  v_deco2 uuid;
  v_washi uuid;
  v_stamp uuid;
  v_memo uuid;
  v_sticker uuid;
BEGIN
  INSERT INTO shop_products (slug, name, category, description, base_price, is_kit, active)
    VALUES ('pastel-dream-journaling-kit', 'Pastel Dream Journaling Kit', 'kit',
      'Kit journaling lengkap berisi 1 buku catatan pastel, 3 rol washi tape pastel, 1 pack stiker estetik, dan memo pad.',
      65000, true, true)
    RETURNING id INTO v_kit;
  INSERT INTO shop_product_variants (product_id, label, price_override, stock_qty, is_preorder, active)
    VALUES (v_kit, 'Kit + Akses Komunitas', 95000, NULL, false, true);

  INSERT INTO shop_products (slug, name, category, description, base_price, active)
    VALUES ('decopaper-vintage-diary-01', 'Decopaper Vintage Diary #01', 'decopaper',
      'Decopaper satuan per lembar dengan motif koran lama & surat antik.', 2500, true)
    RETURNING id INTO v_deco1;
  INSERT INTO shop_product_variants (product_id, label, stock_qty, is_preorder, active) VALUES
    (v_deco1, 'Old Newspaper', 50, false, true),
    (v_deco1, 'Vintage Letter', 50, false, true),
    (v_deco1, 'Postage Stamp Grid', 50, false, true);

  INSERT INTO shop_products (slug, name, category, description, base_price, active)
    VALUES ('decopaper-botanical-leaf-3', 'Decopaper Botanical Leaf #3', 'decopaper',
      'Decopaper daun botani -- tersedia lewat sistem Pre-Order (3 hari).', 2500, true)
    RETURNING id INTO v_deco2;
  INSERT INTO shop_product_variants (product_id, label, stock_qty, is_preorder, active) VALUES
    (v_deco2, 'Eucalyptus Green', NULL, true, true),
    (v_deco2, 'Fern Leaves', NULL, true, true),
    (v_deco2, 'Wildflower', NULL, true, true);

  INSERT INTO shop_products (slug, name, category, description, base_price, active)
    VALUES ('washi-tape-pastel-set', 'Washi Tape Pastel Set (3pcs)', 'washitape',
      'Set washi tape warna pastel lembut untuk menghias halaman buku harianmu.', 28000, true)
    RETURNING id INTO v_washi;
  INSERT INTO shop_product_variants (product_id, label, stock_qty, is_preorder, active) VALUES
    (v_washi, 'Lilac & Peach', 20, false, true),
    (v_washi, 'Mint & Cream', 20, false, true),
    (v_washi, 'Buttercup Yellow', 20, false, true);

  INSERT INTO shop_products (slug, name, category, description, base_price, active)
    VALUES ('wooden-stamp-ink-pad-set', 'Wooden Stamp & Ink Pad Set', 'stamp',
      'Stempel kayu mini motif kalender & border estetis lengkap dengan bantalan tinta mini.', 45000, true)
    RETURNING id INTO v_stamp;
  INSERT INTO shop_product_variants (product_id, label, stock_qty, is_preorder, active) VALUES
    (v_stamp, 'Calendar & Days', NULL, true, true),
    (v_stamp, 'Floral Border', NULL, true, true),
    (v_stamp, 'Minimalist Numbers', NULL, true, true);

  INSERT INTO shop_products (slug, name, category, description, base_price, active)
    VALUES ('grid-dot-memo-pad', 'Grid & Dot Memo Pad (100 Sheets)', 'memopad',
      'Memo pad kertas tebal anti tembus tinta dengan pilihan grid dan dotted.', 15000, true)
    RETURNING id INTO v_memo;
  INSERT INTO shop_product_variants (product_id, label, stock_qty, is_preorder, active) VALUES
    (v_memo, 'Grid Pattern', 30, false, true),
    (v_memo, 'Dotted Pattern', 30, false, true),
    (v_memo, 'Blank Cream', 30, false, true);

  INSERT INTO shop_products (slug, name, category, description, base_price, active)
    VALUES ('vintage-aesthetic-sticker-pack', 'Vintage Aesthetic Sticker Pack', 'sticker',
      'Pack berisi 30 pcs stiker die-cut tahan air dengan ilustrasi vintage dan kata-kata inspiratif.', 12000, true)
    RETURNING id INTO v_sticker;
  INSERT INTO shop_product_variants (product_id, label, stock_qty, is_preorder, active) VALUES
    (v_sticker, 'Botanical Life', 25, false, true),
    (v_sticker, 'Coffee & Books', 25, false, true),
    (v_sticker, 'Traveler Diary', 25, false, true);

  INSERT INTO shop_kit_sessions (label, session_at, zoom_link, max_quota, active)
    VALUES ('Batch #4', NULL, '', 30, true);
END $$;
