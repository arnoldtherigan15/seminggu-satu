-- ============================================================
-- Folder catatan bertingkat (subfolder), ala sidebar Dia/Notion.
-- parent_id null = folder paling atas. Hapus folder ditangani di
-- personal-api (isi & subfolder dipindah ke folder induknya dulu);
-- ON DELETE SET NULL cuma jaring pengaman biar nggak ada yatim nyangkut.
-- ============================================================

alter table personal_note_folders
  add column if not exists parent_id uuid references personal_note_folders(id) on delete set null;

-- index buat kolom FK (lookup anak folder & cascade set null)
create index if not exists personal_note_folders_parent_idx
  on personal_note_folders (parent_id);
