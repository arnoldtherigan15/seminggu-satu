-- rec_batches kebuat tanpa RLS+grant eksplisit (ketinggalan di migration
-- sebelumnya) -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (sama pola kayak semua tabel baru lain di sini,
-- lihat fix_service_role_grants.sql / add_partners.sql dst). Service role
-- (dipakai admin-api & rec-batch Edge Function) butuh grant eksplisit ini
-- buat bisa baca/tulis tabelnya sama sekali.
alter table rec_batches enable row level security;
grant all privileges on rec_batches to service_role;
