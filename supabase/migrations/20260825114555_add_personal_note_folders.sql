-- ============================================================
-- Personal Notes folders -- grouping buat Personal > Notes (bikin
-- folder, pindahin note ke dalamnya). Note tanpa folder (folder_id
-- null) tetap muncul di grup "No Folder" -- ON DELETE SET NULL biar
-- hapus folder nggak ikut ngilangin notes-nya, cuma balik jadi
-- uncategorized.
-- ============================================================

create table personal_note_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

alter table personal_notes add column folder_id uuid references personal_note_folders(id) on delete set null;
create index personal_notes_folder_idx on personal_notes (folder_id);

alter table personal_note_folders enable row level security;
grant all privileges on personal_note_folders to service_role;
