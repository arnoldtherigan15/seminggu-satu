-- ============================================================
-- Personal Notes v2 (ala Craft) -- identitas per catatan + catatan harian.
--   icon      : emoji per catatan ('' = belum ada)
--   color     : warna aksen/cover (key dari palet admin, '' = default)
--   pinned    : disematkan di atas daftar
--   note_date : catatan harian -- maksimal 1 catatan per tanggal
-- Folder juga dapet ikon emoji.
-- Semua kolom punya default konstan -> ADD COLUMN instan (nggak nulis
-- ulang tabel), catatan lama otomatis kebagian nilai default.
-- ============================================================

alter table personal_notes
  add column if not exists icon      text    not null default '',
  add column if not exists color     text    not null default '',
  add column if not exists pinned    boolean not null default false,
  add column if not exists note_date date;

-- 1 tanggal = 1 catatan harian (catatan biasa note_date-nya null, nggak kena)
create unique index if not exists personal_notes_note_date_key
  on personal_notes (note_date) where note_date is not null;

alter table personal_note_folders
  add column if not exists icon text not null default '';
