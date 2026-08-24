-- ============================================================
-- Bucket foto buat Personal > Notes (admin/index.html #notes) --
-- gambar yang disisipin ke isi note, sama pola kayak
-- recommendation-photos/account-photos (public, upload via
-- admin-api "uploadImage" action).
--
-- Jalanin di dev DULU baru production.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('note-photos', 'note-photos', true)
on conflict (id) do nothing;
