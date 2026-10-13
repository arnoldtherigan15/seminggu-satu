-- Toggle manual "udah bayar/belum" per order Toko -- Arnold ngecek sendiri
-- (transfer bank/tunai langsung), BUKAN lewat upload foto bukti bayar kayak
-- pendaftaran workshop. Default false (belum bayar) -- order baru dibikin
-- duluan pas item mulai ditambahin, baru ditandain lunas belakangan.
alter table shop_orders add column is_paid boolean not null default false;
