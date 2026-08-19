-- ============================================================
-- Kategori khusus buat nyatet aliran uang Seminggu Satu <-> pribadi --
-- dipakai pas profit ditarik dari rekening bisnis (BCA) ke rekening
-- yang dipegang Arnold pribadi (mis. Blu), atau pas bayar sesuatu
-- buat kebutuhan Seminggu Satu dari rekening itu.
-- ============================================================
insert into personal_categories (name, type, icon) values
  ('Pendapatan Seminggu Satu', 'income', 'wallet'),
  ('Biaya Seminggu Satu', 'expense', 'archive');
