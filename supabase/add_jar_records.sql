-- ============================================================
-- Fitur baru: Toples Syukur/Impian (gratitude jar). Nyimpen 1 entri per
-- hari per warga, dikelompokkan per bulan -- format sama kayak
-- journal_records/mood_records yang udah ada (JSONB per-member).
--
-- Shape: {"2026-08": {"name":"Toples Syukur","ribbon":"#ffe600",
--         "items":[{"text":"...","day":5,"ts":"2026-08-05T..."}]}}
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

alter table members add column if not exists jar_records jsonb not null default '{}';
