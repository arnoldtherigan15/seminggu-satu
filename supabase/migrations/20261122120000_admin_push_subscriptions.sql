-- ============================================================
-- Push notif ke dashboard admin (PWA). Satu baris = satu device/browser
-- yang udah "Nyalakan notifikasi". Cuma diakses lewat Edge Function
-- (service role) -- RLS nyala tanpa policy = anon/auth nggak bisa baca.
-- ============================================================

create table if not exists admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

alter table admin_push_subscriptions enable row level security;
