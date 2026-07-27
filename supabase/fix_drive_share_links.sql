-- ============================================================
-- Sebagian foto lama (dari migrasi Fase 4) masih pakai link SHARE
-- Google Drive mentah ("drive.google.com/file/d/<id>/view...") --
-- ini halaman preview, BUKAN gambar langsung, jadi nggak bisa
-- dipasang di <img src>. Ketemu 2 kejadian: challenge "Cinema
-- Spread" (gambar contoh) & quest submission Morin (foto karya,
-- bikin story-nya blank pas dibuka). Dicek lewat quest-gallery &
-- showcase: cuma ini yang kena, avatar/event_photos/showcase aman.
--
-- Fix generik (regex, bukan hardcode 1 ID) -- convert ke format
-- lh3.googleusercontent.com yang embeddable, ke SEMUA kolom yang
-- mungkin nyimpen foto migrasi lama, termasuk journal_records
-- (JSONB, di-treat sebagai teks karena polanya aman buat itu -- URL
-- Drive nggak ada karakter yang bisa ngerusak struktur JSON).
--
-- Jalanin di dev DULU baru production, SQL Editor sama kayak biasa.
-- ============================================================

update challenges
set image = regexp_replace(image, 'https://drive\.google\.com/file/d/([-\w]+)/view[^"]*', 'https://lh3.googleusercontent.com/d/\1')
where image like '%drive.google.com/file/%';

update quest_submissions
set photo_url = regexp_replace(photo_url, 'https://drive\.google\.com/file/d/([-\w]+)/view[^"]*', 'https://lh3.googleusercontent.com/d/\1')
where photo_url like '%drive.google.com/file/%';

update event_photos
set photo_url = regexp_replace(photo_url, 'https://drive\.google\.com/file/d/([-\w]+)/view[^"]*', 'https://lh3.googleusercontent.com/d/\1')
where photo_url like '%drive.google.com/file/%';

update members
set journal_records = regexp_replace(journal_records::text, 'https://drive\.google\.com/file/d/([-\w]+)/view[^"]*', 'https://lh3.googleusercontent.com/d/\1', 'g')::jsonb
where journal_records::text like '%drive.google.com/file/%';

-- Cek: harus 0 baris semua (kalau masih ada, berarti pola link-nya beda,
-- kirim ke saya buat dicek manual)
select 'challenges' as tbl, count(*) from challenges where image like '%drive.google.com/file/%'
union all
select 'quest_submissions', count(*) from quest_submissions where photo_url like '%drive.google.com/file/%'
union all
select 'event_photos', count(*) from event_photos where photo_url like '%drive.google.com/file/%'
union all
select 'members.journal_records', count(*) from members where journal_records::text like '%drive.google.com/file/%';
