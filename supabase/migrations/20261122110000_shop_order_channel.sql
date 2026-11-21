-- ============================================================
-- Asal order toko (dari mana pembeli datang): instagram, threads,
-- whatsapp, event, lainnya. Null = belum diisi. Order lama yang
-- ketempel batch event otomatis dianggap 'event'.
-- ============================================================

alter table shop_orders add column if not exists channel text;

alter table shop_orders drop constraint if exists shop_orders_channel_check;
alter table shop_orders
  add constraint shop_orders_channel_check
  check (channel is null or channel in ('instagram', 'threads', 'whatsapp', 'event', 'lainnya'));

update shop_orders set channel = 'event' where channel is null and batch_id is not null;
