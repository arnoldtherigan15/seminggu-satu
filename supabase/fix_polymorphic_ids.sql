-- ============================================================
-- Fix skema: challenges/quest_submissions/event_photos pakai id ASLI
-- (text, dari sheet lama), quest_likes jadi polymorphic (tanpa FK).
-- Alasan lengkap ada di komentar schema.sql.
--
-- GANTI PENDEKATAN: percobaan pertama (ALTER bertahap) gagal karena
-- konflik foreign key lama. Karena ke-4 tabel ini BELUM ada data
-- pentingnya (event_photos yang 9 baris toh mau diimport ulang),
-- lebih aman DROP & BIKIN ULANG dari nol daripada ALTER bertahap.
--
-- Jalanin ini SEKALI di dev, SEKALI di production, SEBELUM import
-- data challenges/quest_submissions/quest_likes/event_photos di Fase 4e.
-- ============================================================

-- Urutan drop PENTING: quest_likes & quest_submissions dulu (biar nggak
-- ke-block foreign key), baru challenges & event_photos.
drop table if exists quest_likes;
drop table if exists quest_submissions;
drop table if exists challenges;
drop table if exists event_photos;

-- ------------------------------------------------------------
-- CHALLENGES — id TEXT (id asli dari sheet, mis. "qmruso2ur")
-- ------------------------------------------------------------
create table challenges (
  id          text primary key,
  title       text not null,
  theme       text,
  description text,
  image       text,
  points      integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table challenges enable row level security;
create policy "challenges_public_read_active" on challenges
  for select to anon using (active = true);

-- ------------------------------------------------------------
-- QUEST_SUBMISSIONS — id TEXT juga
-- ------------------------------------------------------------
create table quest_submissions (
  id           text primary key,
  challenge_id text references challenges(id),
  wa           text not null,
  nickname     text,
  photo_url    text,
  caption      text,
  created_at   timestamptz not null default now()
);
alter table quest_submissions enable row level security;
create index quest_submissions_challenge_id_idx on quest_submissions (challenge_id);
create index quest_submissions_wa_idx on quest_submissions (wa);

-- ------------------------------------------------------------
-- QUEST_LIKES — polymorphic, TANPA foreign key (bisa nunjuk ke
-- quest_submissions, event_photos, ATAU key sintetis "jw_..." yang
-- bukan baris tabel manapun)
-- ------------------------------------------------------------
create table quest_likes (
  target_id  text not null,
  wa         text not null,
  created_at timestamptz not null default now(),
  primary key (target_id, wa)
);
alter table quest_likes enable row level security;

-- ------------------------------------------------------------
-- EVENT_PHOTOS — id TEXT (id asli dari sheet, mis. "evmrxvarn9")
-- ------------------------------------------------------------
create table event_photos (
  id         text primary key,
  tag        text,
  photo_url  text not null,
  caption    text,
  event_date date,
  created_at timestamptz not null default now()
);
alter table event_photos enable row level security;
create index event_photos_tag_idx on event_photos (tag);
create policy "event_photos_public_read" on event_photos
  for select to anon using (true);
