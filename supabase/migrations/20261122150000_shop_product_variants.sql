-- Varian produk (mis. Journaling Kit: Blue Cat, Red Flower). Array teks; [] = tanpa varian.
-- Varian yang dipilih pembeli disimpen di shop_sales.notes (kolom yang udah ada), jadi
-- invoice & label kirim otomatis nampilin "Journaling Kit (1) - Blue Cat".
alter table shop_products add column if not exists variants jsonb not null default '[]'::jsonb;
