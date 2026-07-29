-- ============================================================
-- Fitur baru: Jurnal Bulanan -- tempat "luapin perasaan" lewat tulisan
-- bebas, dikemas sebagai buku fisik (custom nama + sampul) yang bisa
-- di-flip kayak Paspor/Profil Kamu. Pola datanya SAMA persis kayak
-- jar_records: JSONB per-member, key "YYYY-MM", 1 entri/hari (biar
-- nggak jadi beban -- expressive writing tanpa tekanan), nama & sampul
-- kesimpen per bulan jadi tiap "buku" bisa beda gaya.
--
-- Shape: {"2026-07": {"name":"Juli yang Berat","cover":"pattern-3",
--         "entries":[{"text":"...","day":14,"ts":"2026-07-14T..."}]}}
--
-- cover: "" (default navy) | "pattern-1".."pattern-19" | "custom"
-- (custom = reuse profile_bg_custom yang sama kayak sampul Profil Kamu,
-- nggak ada slot upload baru lagi -- 1 slot custom buat semua sampul).
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

alter table members add column if not exists writing_records jsonb not null default '{}';
