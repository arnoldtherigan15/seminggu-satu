-- "Koleksi Rekomendasi" -- Arnold mau bisa bikin beberapa KOLEKSI produk
-- (beda dari list Rekomendasi Alat & Bahan yang satu-satunya & global di
-- /recommendation.html), tiap koleksi punya judul sendiri + daftar item
-- (nama, deskripsi, gambar, link produk) sendiri, dan dapet LINK + QR unik
-- buat di-share (mis. link beda buat tiap kolaborasi/konten/event promo).
create table rec_batches (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bucket public buat foto item koleksi -- sama pola kayak recommendation-photos.
insert into storage.buckets (id, name, public)
values ('rec-batch-photos', 'rec-batch-photos', true)
on conflict (id) do nothing;
