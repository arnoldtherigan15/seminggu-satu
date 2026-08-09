-- ============================================================
-- Bucket foto buat item Rekomendasi Alat & Bahan (admin/index.html
-- #konten) -- sebelumnya cuma bisa ketik path gambar manual (mis.
-- images/reccomendation/x.webp), sekarang bisa upload langsung dari
-- admin panel (tersimpan di Storage, sama pola kayak quest-photos dll).
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('recommendation-photos', 'recommendation-photos', true)
on conflict (id) do nothing;
