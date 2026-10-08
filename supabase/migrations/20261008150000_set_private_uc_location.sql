-- Default lokasi "private-uc" disamain kayak "journaling-date" (Journaling
-- Date Intimate) -- sama venue, Cartea Books & Bistro.
update batches
set location_name = 'Cartea Books & Bistro',
    maps_link = 'https://maps.app.goo.gl/PB3RCJnoU23HTPt39'
where workshop_type = 'private-uc' and location_name is null;
