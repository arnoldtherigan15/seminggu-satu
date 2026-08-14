-- ============================================================
-- Fitur baru: Selipan Jurnal di Mading Warga -- buat warga yang journaling
-- di buku pribadi (bukan tema drive bersama) tapi tetep pengen share karyanya.
-- Terpisah dari Challenge/Leaderboard (nggak dapet poin, nggak dibanding-
-- bandingin) -- murni opt-in sharing, sama semangatnya kayak sticky note
-- di Mading. Max 1 postingan AKTIF per warga (bukan kuota harian/mingguan
-- kayak board_messages/barter_posts -- di sini benar-benar 1 slot, warga
-- musti hapus punya lama dulu baru bisa post yang baru).
--
-- Auto-fresh: postingan lebih dari seminggu otomatis kehapus -- SAMA PERSIS
-- pola retensi kayak board_messages & barter_posts (7 hari), biar konsisten
-- sama "rules Mading" yang udah ada, bukan bikin aturan retensi baru.
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

create table if not exists mading_journal_posts (
  id         uuid primary key default gen_random_uuid(),
  wa         text not null,
  nickname   text,
  caption    text,
  photo_url  text not null,
  created_at timestamptz not null default now()
);
alter table mading_journal_posts enable row level security;
create index if not exists mading_journal_posts_wa_idx on mading_journal_posts (wa);

grant all privileges on mading_journal_posts to service_role;

-- Bucket foto jurnal Mading -- public, sama pola kayak barter-photos.
-- SENGAJA bucket baru (bukan numpang di "journal-photos" yang udah ada),
-- soalnya bucket itu punya fitur beda: check-in Weekly Journal Tracker
-- (privat, dibersihin cron bulanan by member.journal_records). Kalau
-- dicampur, riskan ke-mixed-up sama cron cleanup yang beda logic.
insert into storage.buckets (id, name, public)
values ('mading-journal-photos', 'mading-journal-photos', true)
on conflict (id) do nothing;
