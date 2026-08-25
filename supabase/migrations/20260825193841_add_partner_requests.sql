-- ============================================================
-- Partner "requests" template (List Partner) -- hal-hal yang biasa
-- diminta partner itu (mis. "wajib bikin reels sebelum acara",
-- "list pertanyaan interview") dicatat SEKALI di partner, bukan
-- diketik ulang tiap event. Batch-batch Prep yang "narik" partner ini
-- (lihat prep__partnerreq__ key di admin-api) COPY array ini ke
-- checklist khusus batch itu -- edit/hapus di 1 batch nggak nyentuh
-- template partner atau batch lain.
-- ============================================================

alter table partners add column requests jsonb not null default '[]';
