-- Default jam sesi "private-uc" -- tanggal/lokasi masih nunggu Arnold isi
-- manual lewat admin, tapi jam di-set default dulu biar nggak kosong.
update batches
set workshop_time = '11.00 - 13.30 WIB'
where workshop_type = 'private-uc' and workshop_time is null;
