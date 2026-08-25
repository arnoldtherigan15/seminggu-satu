-- ============================================================
-- Item Database items yang bukan barang fisik (jasa/layanan, misal
-- "Cetak Banner") ga punya konsep stok -- flag ini bikin item kayak gitu
-- skip dari Stok badge & Inventory Buy/Use tracking sama sekali, alih-alih
-- selalu nampilin "Stok: 0" (merah, kesannya kehabisan) padahal emang
-- nggak pernah dimaksudkan buat dilacak.
-- ============================================================

alter table cost_items add column no_stock boolean not null default false;
