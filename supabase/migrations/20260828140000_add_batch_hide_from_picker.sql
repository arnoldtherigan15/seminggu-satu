-- ============================================================
-- Batch bisa aktif (nerima pendaftaran) TAPI disembunyiin dari batch
-- picker publik -- link-only, cuma bisa diakses lewat ?vol=/?batch=
-- di halaman workshop. Beda dari "Tutup Batch" (active=false) yang
-- beneran nutup pendaftaran; ini cuma ngatur kemunculan di UI publik,
-- batch-nya tetap kehitung normal di semua kalkulasi/kuota/dsb.
-- ============================================================
alter table batches add column hide_from_picker boolean not null default false;
