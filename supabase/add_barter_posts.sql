-- ============================================================
-- Fitur baru: Barter Warga -- section TERPISAH dari Mading. Warga bisa
-- post barang yang mau ditukar (foto + teks), max 2/minggu. Card diklik
-- langsung buka chat WA orangnya (pesan udah keisi otomatis).
--
-- Auto-fresh: postingan lebih dari seminggu otomatis kehapus (sama pola
-- kayak board_messages) biar section-nya nggak menuh-menuhin.
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

-- status: 'open' (masih bisa dibarter) atau 'done' (selesai/diarsip -- tetep
-- keliatan di list biar warga lain tau, tapi ditandain "beres", bukan
-- dihapus). Bisa diset warga sendiri (arsip punya sendiri) atau admin
-- (tandai selesai / moderasi).
create table if not exists barter_posts (
  id         uuid primary key default gen_random_uuid(),
  wa         text not null,
  nickname   text,
  item_text  text not null,
  photo_url  text not null default '',
  status     text not null default 'open',
  created_at timestamptz not null default now()
);
alter table barter_posts enable row level security;
create index if not exists barter_posts_wa_idx on barter_posts (wa);
-- Jaga-jaga kalau file ini udah pernah dijalanin sebelum kolom status ada.
alter table barter_posts add column if not exists status text not null default 'open';

grant all privileges on barter_posts to service_role;

-- Bucket foto barter -- public, sama pola kayak quest-photos/menu-photos.
insert into storage.buckets (id, name, public)
values ('barter-photos', 'barter-photos', true)
on conflict (id) do nothing;
