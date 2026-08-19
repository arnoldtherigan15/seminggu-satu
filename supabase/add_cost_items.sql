-- ============================================================
-- Database item biaya/modal yang bisa dipakai ulang lintas
-- workshop/batch (mis. "Lem Uhu" dipakai di banyak event) -- item
-- punya nama, harga default, foto & link toko (opsional). Dipakai
-- sebagai sumber autocomplete pas isi "Komponen Modal / Biaya" di tab
-- Keuangan, harganya tetep bisa di-adjust per event/batch (item cuma
-- ngasih nilai AWAL, bukan link permanen -- baris biaya yang udah
-- kesimpen di MODAL tetep snapshot nama+harga sendiri, independen).
-- ============================================================
create table cost_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  default_price bigint not null default 0,
  image_url     text,
  link          text,
  created_at    timestamptz not null default now()
);

alter table cost_items enable row level security;
-- GRANT eksplisit (bukan tabel personal_*, tapi kena gotcha yang sama --
-- lihat fix_service_role_grants.sql).
grant all privileges on cost_items to service_role;

insert into storage.buckets (id, name, public)
values ('cost-item-photos', 'cost-item-photos', true)
on conflict (id) do nothing;
