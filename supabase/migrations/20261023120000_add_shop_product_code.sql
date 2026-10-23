-- Kode produk (mis. "sticked sheet paket" -> SSP4821): inisial tiap kata
-- nama produk + 4 digit acak. Dibikin di DB (trigger), bukan di edge
-- function, biar produk dari jalur mana pun pasti dapet kode & dijamin unik.
-- SENGAJA nggak ikut berubah kalau nama produk diganti -- kode yang udah
-- dicatat/ditempel di mana-mana harus tetep nunjuk ke produk yang sama.
create or replace function gen_shop_product_code(p_name text) returns text
language plpgsql as $$
declare
  initials text;
  candidate text;
begin
  select upper(string_agg(left(w, 1), '')) into initials
  from regexp_split_to_table(coalesce(p_name, ''), '[^[:alnum:]]+') as w
  where w <> '';
  initials := coalesce(nullif(initials, ''), 'PRD');
  loop
    candidate := initials || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from shop_products where code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table shop_products add column code text;

-- Per baris (bukan 1 UPDATE massal) -- cek unik di gen_shop_product_code
-- nggak bisa liat kode yang baru diisi di statement yang SAMA.
do $$
declare r record;
begin
  for r in select id, name from shop_products where code is null loop
    update shop_products set code = gen_shop_product_code(r.name) where id = r.id;
  end loop;
end;
$$;

alter table shop_products alter column code set not null;
alter table shop_products add constraint shop_products_code_key unique (code);

create or replace function shop_products_set_code() returns trigger
language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := gen_shop_product_code(new.name);
  end if;
  return new;
end;
$$;

create trigger shop_products_set_code
  before insert on shop_products
  for each row execute function shop_products_set_code();
