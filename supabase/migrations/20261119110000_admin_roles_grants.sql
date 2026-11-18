-- GRANT eksplisit -- tabel baru di project ini nggak reliably kewarisin
-- default-privileges grant (lihat fix_service_role_grants.sql). Tanpa ini
-- edge function (service role) nggak bisa baca/tulis sesi admin & tim.
grant all privileges on admin_users, admin_sessions, team_members to service_role;
