-- Sebelum fix ini, order buat "pembeli lain" (bukan peserta -- registration_id
-- null) masih kepaksa ketempel batch_id/workshop_type dari event yang lagi
-- dipilih admin pas dibikin (UI lama nggak ngasih opsi lain). Sekarang order
-- "pembeli lain" dibikin SENGAJA lepas (batch_id/workshop_type null) biar
-- muncul di subtab "Pembeli Lain" yang baru (difilter per tahun/bulan).
-- Backfill order LAMA yang kepaksa ketempel itu biar ikut pindah ke sana,
-- bukan nyangkut nggak keliatan di subtab manapun.
update shop_orders set batch_id = null, workshop_type = null where registration_id is null;
