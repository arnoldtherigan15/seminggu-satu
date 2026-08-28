-- ============================================================
-- Task Tracker: board Backlog/In Progress/Done buat task manual DAN
-- task yang di-generate otomatis pas ada data yang kelupaan diisi
-- (Cost & Budget per batch, Prep per workshop type, Venue per batch).
-- Auto-task cuma dibikin sekali per (check_type, ref) -- kalau row-nya
-- udah ada (status apapun, termasuk 'done'), detection engine ga bikin
-- duplikat lagi walau gap-nya masih ada, biar Arnold bisa dismiss
-- permanen tanpa data aslinya harus beneran diisi.
-- ============================================================

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'backlog',   -- backlog | in_progress | done
  source text not null default 'manual',    -- manual | auto
  check_type text,                          -- cost_budget | prep | venue (auto doang)
  ref_workshop_type text,                   -- dipake buat label + dedupe key prep
  ref_batch_id uuid references batches(id) on delete cascade,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- satu auto-task per (check_type, batch) buat cost_budget/venue
create unique index tasks_auto_batch_unique on tasks (check_type, ref_batch_id)
  where source = 'auto' and ref_batch_id is not null;
-- satu auto-task per (check_type, workshop_type) buat prep (ga per-batch)
create unique index tasks_auto_workshop_unique on tasks (check_type, ref_workshop_type)
  where source = 'auto' and ref_batch_id is null;

alter table tasks enable row level security;
grant all privileges on tasks to service_role;
