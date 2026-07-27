-- ============================================================
-- Seminggu Satu — Skema Database Supabase (Fase 1)
--
-- CARA PAKAI:
-- 1. Buka project "seminggu-satu-dev" di dashboard Supabase.
-- 2. Buka SQL Editor -> New query.
-- 3. Paste SELURUH isi file ini -> klik Run.
-- 4. Cek di Table Editor: 12 tabel harus muncul.
-- 5. Kalau lancar di dev, ulangi persis file yang sama di project
--    "seminggu-satu" (production).
--
-- Semua tabel di-set RLS (Row Level Security) ON tapi BELUM ada
-- policy sama sekali di fase ini -> artinya semua akses dari
-- browser (anon/publishable key) otomatis KETUTUP dulu. Ini aman
-- by default. Policy-nya baru dibikin di Fase 3.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) MEMBERS — akun warga (ganti sheet "members")
-- ------------------------------------------------------------
create table members (
  wa              text primary key,                 -- nomor WA (kunci utama, ganti kolom "wa" di Sheet)
  nickname        text not null,
  birth_date      date,
  pass_hash       text,                              -- SHA-256(salt+password), sama kayak sekarang
  salt            text,
  token           text,                              -- token sesi aktif (auto-login)
  photo_url       text,
  bio             text,
  journal_records jsonb not null default '{}',        -- {"2026-07": {"26": true}}
  mood_records    jsonb not null default '{}',         -- {"2026-07": {"26": "cerah"}}
  public_opt_in   boolean not null default false,      -- setuju tampil di /balai
  public_id       text generated always as (substr(md5('ssbalai:' || wa), 1, 8)) stored,
  created_at      timestamptz not null default now(),
  last_login      timestamptz
);
alter table members enable row level security;

-- ------------------------------------------------------------
-- 2) BATCHES — registry batch per workshop (ganti sheet "batches")
-- ------------------------------------------------------------
create table batches (
  id            uuid primary key default gen_random_uuid(),
  workshop_type text not null,      -- '3d-frame-journaling', 'paper-journal', dst
  sheet_name    text,               -- nama tab sheet asli (referensi migrasi -- buat cocokin registrations pas Fase 4)
  label         text,               -- label tampilan, mis. "Batch Mei 2026"
  event_date    date,
  active        boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table batches enable row level security;
create index batches_workshop_type_idx on batches (workshop_type);

-- ------------------------------------------------------------
-- 3) REGISTRATIONS — pendaftaran workshop (ganti 6 sheet per-batch)
--    Field yang beda-beda tiap workshop (warna, jumlah foto, dll)
--    ditaruh di kolom "extra" (jsonb), bukan bikin kolom per jenis.
-- ------------------------------------------------------------
create table registrations (
  id                uuid primary key default gen_random_uuid(),
  workshop_type     text not null,
  batch_id          uuid references batches(id),
  wa                text not null,
  full_name         text,
  nickname          text,
  ig_username       text,
  consent           boolean not null default false,
  payment_proof_url text,
  attendance        boolean not null default false,
  extra             jsonb not null default '{}',
  created_at        timestamptz not null default now()
);
alter table registrations enable row level security;
create index registrations_workshop_type_idx on registrations (workshop_type);
create index registrations_batch_id_idx on registrations (batch_id);
create index registrations_wa_idx on registrations (wa);

-- ------------------------------------------------------------
-- 4) CHALLENGES — side quest (ganti sheet "challenges")
--    id TEXT (pakai id asli dari sheet lama, mis. "qmruso2ur"), BUKAN uuid --
--    karena quest_likes (di bawah) referensiin id ini apa adanya dari data lama.
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

-- ------------------------------------------------------------
-- 5) QUEST_SUBMISSIONS — partisipasi side quest (ganti sheet "quest_submissions")
--    id TEXT juga (sama alasannya kayak challenges.id).
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
-- 6) QUEST_LIKES — like, TAPI polymorphic (ganti sheet "quest_likes")
--    Data asli nunjukin target_id bisa isi id quest_submissions ("sm..."),
--    id event_photos ("ev..."), ATAU key sintetis check-in mingguan
--    ("jw_<wa>_<weekKey>", BUKAN baris tabel manapun). Makanya TANPA
--    foreign key (nggak bisa dipaksa nunjuk ke 1 tabel doang).
-- ------------------------------------------------------------
create table quest_likes (
  target_id  text not null,
  wa         text not null,
  created_at timestamptz not null default now(),
  primary key (target_id, wa)
);
alter table quest_likes enable row level security;

-- ------------------------------------------------------------
-- 7) EVENT_PHOTOS — galeri foto event (ganti sheet "event_photos")
--    id TEXT (id asli dari sheet, mis. "evmrxvarn9") -- sama alasannya:
--    dipakai sebagai target_id di quest_likes.
-- ------------------------------------------------------------
create table event_photos (
  id         text primary key,
  tag        text,          -- 'workshop' | 'reka-rekat' | 'temu-warga'
  photo_url  text not null,
  caption    text,
  event_date date,
  created_at timestamptz not null default now()
);
alter table event_photos enable row level security;
create index event_photos_tag_idx on event_photos (tag);

-- ------------------------------------------------------------
-- 8) BOARD_MESSAGES — Mading Warga (ganti sheet "board_messages")
-- ------------------------------------------------------------
create table board_messages (
  id         uuid primary key default gen_random_uuid(),
  wa         text not null,
  nickname   text,
  message    text not null,
  created_at timestamptz not null default now()
);
alter table board_messages enable row level security;
create index board_messages_wa_idx on board_messages (wa);

-- ------------------------------------------------------------
-- 9) SUGGESTIONS + SUGGESTION_VOTES — usul & vote warga (ganti sheet "suggestions")
--    Vote di Sheet lama disimpen sebagai JSON array di 1 kolom.
--    Di Postgres dipisah jadi tabel sendiri: lebih rapi, dan anti-vote-dobel
--    otomatis lewat primary key (suggestion_id, wa) -- bukan cek manual di kode.
-- ------------------------------------------------------------
create table suggestions (
  id         uuid primary key default gen_random_uuid(),
  wa         text not null,
  nickname   text,
  category   text not null,
  message    text not null,
  created_at timestamptz not null default now()
);
alter table suggestions enable row level security;

create table suggestion_votes (
  suggestion_id uuid references suggestions(id) on delete cascade,
  wa            text not null,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, wa)
);
alter table suggestion_votes enable row level security;

-- ------------------------------------------------------------
-- 10) LEADS — CRM outreach admin (ganti sheet leads)
-- ------------------------------------------------------------
create table leads (
  id           uuid primary key default gen_random_uuid(),
  platform     text,
  username     text,
  status       text,
  following    boolean not null default false,
  notes        text,
  last_contact timestamptz,
  created_at   timestamptz not null default now()
);
alter table leads enable row level security;

-- ------------------------------------------------------------
-- 11) APP_CONFIG — key-value config (ganti getConfigValue_/setConfigValue_)
-- ------------------------------------------------------------
create table app_config (
  key        text primary key,
  value      text not null,   -- teks bebas (kadang JSON string, kadang teks biasa) -- sama kayak Sheet "app-config"
  updated_at timestamptz not null default now()
);
alter table app_config enable row level security;

-- ------------------------------------------------------------
-- 12) CONTENT_ITEMS — konten halaman publik (ganti sheet "galeri",
--     "testimoni", "recommendation", "links" -- pola CONTENT_DEFS di kode).
--     4 sheet beda kolom digabung 1 tabel + content_type + extra (jsonb),
--     sama kayak pendekatan "registrations".
-- ------------------------------------------------------------
create table content_items (
  id           uuid primary key default gen_random_uuid(),
  content_type text not null,   -- 'galeri' | 'testimoni' | 'recommendation' | 'links'
  title        text,
  extra        jsonb not null default '{}',  -- embedCode, atau image/description/link/category, atau url/icon/subtitle
  created_at   timestamptz not null default now()
);
alter table content_items enable row level security;
create index content_items_type_idx on content_items (content_type);

-- ------------------------------------------------------------
-- 13) WORKSHOP_COSTS — biaya/modal per workshop (ganti sheet "modal-config")
--     Data finansial internal -- TIDAK ada akses publik sama sekali.
-- ------------------------------------------------------------
create table workshop_costs (
  id            uuid primary key default gen_random_uuid(),
  workshop_type text not null,
  batch         text not null default '',  -- '' = biaya general/default utk workshop itu
  name          text not null,             -- "Nama Biaya"
  amount        numeric not null default 0,-- "Biaya"
  kind          text not null default 'per-peserta' check (kind in ('tetap', 'per-peserta')),
  created_at    timestamptz not null default now()
);
alter table workshop_costs enable row level security;
create index workshop_costs_workshop_type_idx on workshop_costs (workshop_type);
