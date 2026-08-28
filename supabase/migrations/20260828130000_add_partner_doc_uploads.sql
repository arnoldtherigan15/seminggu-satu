-- ============================================================
-- Upload PDF manual buat MOU/Invoice -- selain yang digenerate dari
-- form (source='generated', tersimpan di `data` jsonb), Arnold bisa
-- upload file PDF asli (mis. MOU yang udah ditandatangan & di-scan)
-- langsung ke list yang sama. `source` bedain dua jenis ini biar UI
-- bisa nampilin badge + klik-behaviour yang beda (generated -> buka
-- form edit, uploaded -> buka/preview PDF-nya langsung).
-- Bucket PRIVATE (dokumen kerjasama bisnis) -- signed URL di-generate
-- server-side tiap listPartnerDocs, bukan public URL permanen.
-- ============================================================
alter table partner_documents add column source text not null default 'generated' check (source in ('generated', 'uploaded'));
alter table partner_documents add column file_path text;

insert into storage.buckets (id, name, public)
values ('partner-doc-files', 'partner-doc-files', false)
on conflict (id) do nothing;
