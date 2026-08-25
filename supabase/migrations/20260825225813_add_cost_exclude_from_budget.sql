-- ============================================================
-- Cost item per-participant kayak revenue share/kolaborasi partner (mis.
-- "Sharing Revenue Tutorista") tetep ngurangin Total Costs/Profit, tapi
-- jangan ikut ke-hitung di stat "Cost per Participant" -- stat itu
-- maksudnya buat biaya nge-servis 1 peserta (materi/konsumsi/dst), bukan
-- biaya kerjasama/bisnis yang kebetulan skalanya per peserta.
-- ============================================================

alter table workshop_costs add column exclude_from_budget boolean not null default false;
