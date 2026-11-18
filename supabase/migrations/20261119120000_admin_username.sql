-- Login admin pakai username + password (bukan password doang). Password-only
-- berarti 1 tebakan dicocokin ke SEMUA akun, dan 2 orang bisa nggak sengaja
-- punya password sama. Username unik, case-insensitive.
alter table public.admin_users add column if not exists username text;
create unique index if not exists admin_users_username_key on public.admin_users (lower(username));
