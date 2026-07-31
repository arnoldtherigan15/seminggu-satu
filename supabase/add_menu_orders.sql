-- ============================================================
-- Fitur baru: Pesanan Minum/Makan per event -- ganti cara manual
-- ngitung siapa pesen apa dari chat WA jadi link isian + summary
-- otomatis buat dikirim ke vendor.
--
-- menu_items = katalog menu GLOBAL (reusable lintas event, bukan
-- didupilkasi per event) -- admin CRUD dari admin panel.
-- event_orders = pesanan peserta, terikat ke batches.id (1 baris =
-- 1 peserta pesen 1 menu; kalau mau 2 minuman, submit/isi 2x).
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists event_orders (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  participant_name text not null,
  menu_item_id uuid not null references menu_items(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists event_orders_batch_idx on event_orders(batch_id);

-- Tabel baru kadang nggak otomatis kewarisin grant ke service_role (pernah
-- kejadian sebelumnya, lihat fix_service_role_grants.sql) -- eksplisit aja
-- di sini biar migration ini nggak gantung ke fix lain yang mungkin belum
-- ke-apply di project ini.
grant all privileges on menu_items, event_orders to service_role;

-- Bucket foto menu (optional per item) -- public, sama pola kayak
-- quest-photos/event-photos.
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;
