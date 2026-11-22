-- Fix: tabel baru di project ini butuh GRANT eksplisit ke service_role
-- (Edge Function pakai service role). Tanpa ini -> "permission denied for
-- table admin_push_subscriptions" pas nyalain notifikasi di admin.
grant all privileges on admin_push_subscriptions to service_role;
