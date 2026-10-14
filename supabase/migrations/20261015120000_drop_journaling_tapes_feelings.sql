-- Feelings-picker dicabut dari web flow (redundant -- peserta UDAH nulis +
-- milih 3 perasaan di kartu kertas Prompt 2, nyuruh pilih lagi di HP cuma
-- ngulang hal yang sama). Kolom ini belum pernah kepake buat data beneran
-- (fitur belum launch), jadi aman di-drop langsung tanpa migrasi data.
alter table journaling_tapes drop column feelings;
