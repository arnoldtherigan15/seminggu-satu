-- ============================================================
-- Event Roadmap: planning hub buat ide/tema event ke depan (sampe
-- berbulan-bulan), venue database (biar ga ulang2 ketik nama+link
-- maps), sama pipeline partner per ide (siapa yg udah di-contact/
-- mungkin bisa diajak) -- semua ini SEBELUM sesuatu jadi batch
-- beneran di Config/Prep.
-- ============================================================

create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  maps_link text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table event_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,                    -- nama tema/ide besar, mis. "Under Construction"
  workshop_type text,                     -- opsional, salah satu WORKSHOP_TYPES -- null = belum tau/ide baru
  target_month text,                      -- 'YYYY-MM', perkiraan waktu eksekusi
  status text not null default 'idea',    -- idea | planned | confirmed | done
  theme_description text,                 -- prolog/catatan tema (manual atau hasil AI)
  questions jsonb not null default '[]',  -- [{label, question}] pertanyaan refleksi hasil generate AI
  venue_id uuid references venues(id) on delete set null,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Sengaja TERPISAH dari tabel `partners` (yang beneran dipake MOU/Invoice/
-- Prep) -- partner_id null = prospek yang belum masuk Partners DB (masih
-- "mungkin bisa diajak", disimpen namanya doang di partner_name).
create table event_idea_partners (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references event_ideas(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  partner_name text,
  status text not null default 'possible', -- possible | in_touch | proposed | confirmed | declined
  notes text,
  created_at timestamptz not null default now()
);
create index event_idea_partners_idea_idx on event_idea_partners (idea_id);

alter table venues enable row level security;
alter table event_ideas enable row level security;
alter table event_idea_partners enable row level security;
grant all privileges on venues, event_ideas, event_idea_partners to service_role;
