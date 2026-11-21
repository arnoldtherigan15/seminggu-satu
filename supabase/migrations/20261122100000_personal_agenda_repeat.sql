-- ============================================================
-- Agenda berulang di Kalender admin (mis. kelas tiap Selasa, bayar
-- sesuatu tiap tgl 5, ulang tahun tiap tahun). Kejadiannya dihitung di
-- personal-api (getCalendar), di sini cuma aturan-nya.
--   repeat       : '' (sekali) | 'weekly' | 'monthly' | 'yearly'
--   repeat_until : tanggal terakhir boleh muncul (null = terus)
-- ============================================================

alter table personal_agenda
  add column if not exists repeat text not null default '',
  add column if not exists repeat_until date;

alter table personal_agenda drop constraint if exists personal_agenda_repeat_check;
alter table personal_agenda
  add constraint personal_agenda_repeat_check check (repeat in ('', 'weekly', 'monthly', 'yearly'));
