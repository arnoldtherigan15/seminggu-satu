-- "Unsent Cassette" -- pengganti digital buat sesi rekam suara 30 detik di
-- Reka Rekat Vol 6 (Sabtu, 17 Okt 2026) setelah semua kaset fisik rusak.
-- One-off buat event itu doang (nggak perlu batch_id/workshop link -- cuma
-- dipake sekali, kalau suatu saat dipake lagi itu obrolan terpisah).
--
-- SENGAJA tanpa nama/WA/identitas apapun -- Community Airwaves dirancang
-- anonim dari konsepnya sendiri (opsi "Shared Anonymously" di kartu kegiatan),
-- jadi tabel ini nggak nyimpen siapa ngomong apa sama sekali.
create table journaling_tapes (
  id uuid primary key default gen_random_uuid(),
  color text not null,            -- warna shell kaset (hex), dipilih dari 3 perasaan
  feelings text[] not null,       -- 3 kata perasaan yang dipilih (dari kartu prompt)
  audio_url text not null,
  created_at timestamptz not null default now()
);

alter table journaling_tapes enable row level security;
-- Sengaja NGGAK ada policy publik lewat RLS -- endpoint publik
-- (journaling-tape Edge Function) pakai service role (bypass RLS), sama
-- pola kayak shop-sell. GRANT eksplisit -- tabel baru di project ini nggak
-- reliably kewarisin default-privileges grant.
grant all privileges on journaling_tapes to service_role;

insert into storage.buckets (id, name, public)
values ('journaling-tape-audio', 'journaling-tape-audio', true)
on conflict (id) do nothing;
