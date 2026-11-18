-- Role admin + akun Tim Balai Warga.
--
-- admin_users   : akun admin selain super admin (super = password lama di
--                 secret ADMIN_PASSWORD_HASH, nggak disimpan di tabel ini).
--                 Role 'assistant' cuma boleh pakai aksi event (Pendaftar,
--                 Prep, Pesanan) -- dibatasi di admin-api, bukan cuma di UI.
-- admin_sessions: 1 baris per login (per perangkat). Dulu cuma ada 1 token
--                 di app_config, jadi login di HP nendang sesi laptop.
-- team_members  : nomor WA tim Seminggu Satu. Boleh aktivasi akun Balai
--                 Warga tanpa pernah ikut event, dan nggak dihitung di
--                 peringkat (biar tim nggak "bersaing" sama warga).

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'assistant' check (role in ('super', 'assistant')),
  pass_hash text not null,
  salt text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table if not exists public.admin_sessions (
  token text primary key,
  user_id uuid references public.admin_users(id) on delete cascade,
  role text not null check (role in ('super', 'assistant')),
  name text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);

create table if not exists public.team_members (
  wa text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);

-- Cuma diakses edge function pakai service role; tutup akses langsung dari client.
alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.team_members enable row level security;
