-- ============================================================
-- Personal Video Links -- daftar link video (YouTube/Vimeo/dst) Arnold
-- mau ditonton nanti, dikelompokkin per folder. Bukan bisnis Seminggu
-- Satu, numpang di section "Personal" yang sama kayak Financial Tracker/
-- Notes/Password Manager. Struktur folder sama persis polanya kayak
-- personal_note_folders (folder opsional, hapus folder nggak ikut
-- ngilangin link di dalamnya -- ON DELETE SET NULL).
-- ============================================================

create table personal_video_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table personal_video_links (
  id         uuid primary key default gen_random_uuid(),
  folder_id  uuid references personal_video_folders(id) on delete set null,
  url        text not null,
  title      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personal_video_links_folder_idx on personal_video_links (folder_id);
create index personal_video_links_updated_idx on personal_video_links (updated_at desc);

alter table personal_video_folders enable row level security;
alter table personal_video_links enable row level security;
-- Sengaja NGGAK ada policy publik -- cuma diakses lewat service role di
-- personal-api (requireAdminAuth), sama pola kayak semua tabel personal_* lain.

-- GRANT eksplisit -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (lihat fix_service_role_grants.sql).
grant all privileges on personal_video_folders to service_role;
grant all privileges on personal_video_links to service_role;
