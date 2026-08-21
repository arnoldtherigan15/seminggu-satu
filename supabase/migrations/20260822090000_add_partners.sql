-- ============================================================
-- Partners (List Partner / MOU / Invoice) -- Arnold ngelola kerjasama
-- brand (mis. Essens x Side by Side) & invoice (mis. reimbursement
-- transport ke venue) yang sebelumnya cuma file lepas di luar sistem.
--
-- `data` jsonb (bukan kolom rigid) karena term tiap deal beda-beda --
-- sama pola kayak registrations.extra. partner_id di partner_documents
-- sengaja ON DELETE SET NULL (bukan CASCADE) -- hapus partner nggak
-- boleh ngilangin histori MOU/invoice yang udah pernah diterbitkan.
-- ============================================================

create table partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  pic_name   text,
  pic_role   text,
  email      text,
  phone      text,
  notes      text,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create table partner_documents (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid references partners(id) on delete set null,
  type        text not null check (type in ('mou', 'invoice')),
  title       text not null,
  doc_date    date not null default current_date,
  status      text not null default 'draft',
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index partner_documents_partner_idx on partner_documents (partner_id);
create index partner_documents_type_idx on partner_documents (type);

alter table partners enable row level security;
alter table partner_documents enable row level security;
-- Sengaja NGGAK ada policy publik -- cuma diakses lewat service role di
-- admin-api (requireAdminAuth), sama pola kayak semua tabel admin-only lain.

-- GRANT eksplisit -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (lihat fix_service_role_grants.sql).
grant all privileges on partners, partner_documents to service_role;
