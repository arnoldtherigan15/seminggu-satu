-- QR Generator (submenu di Koleksi Rekomendasi) -- beda dari rec_batches:
-- ini QR-nya langsung encode LINK EKSTERNAL APA AJA (mis. link grup WA
-- komunitas), bukan link ke halaman share /rec/ kita. "title" cuma label
-- buat Arnold sendiri inget/nyari-nyari di daftar, nggak ikut ke-encode.
create table qr_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  link text not null,
  created_at timestamptz not null default now()
);

alter table qr_links enable row level security;
-- Sengaja NGGAK ada policy publik -- cuma diakses lewat service role di
-- admin-api (requireAdminAuth), sama pola kayak semua tabel admin-only lain.
grant all privileges on qr_links to service_role;
