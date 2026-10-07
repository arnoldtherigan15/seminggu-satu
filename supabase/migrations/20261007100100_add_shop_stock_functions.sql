-- Decrement/restore stok ATOMIK -- Supabase JS .update() nggak bisa nulis
-- ekspresi relatif-ke-kolom ("stock_qty - qty"), jadi dua orang checkout
-- bareng buat varian stok 1 bisa kebagian dua-duanya kalau dihitung di JS
-- (baca-lalu-tulis, ada celah race). Function ini yang jadi satu-satunya
-- jalan nulis stock_qty, jalan dalam 1 statement SQL di DB jadi aman dari
-- race itu. stock_qty null (made-to-order/unlimited) dibiarin null terus,
-- nggak pernah dikurangin.
create or replace function reserve_shop_stock(p_variant_id uuid, p_qty integer)
returns boolean
language plpgsql
as $$
declare
  affected integer;
begin
  update shop_product_variants
    set stock_qty = stock_qty - p_qty
    where id = p_variant_id and stock_qty is not null and stock_qty >= p_qty;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

create or replace function release_shop_stock(p_variant_id uuid, p_qty integer)
returns void
language plpgsql
as $$
begin
  update shop_product_variants
    set stock_qty = stock_qty + p_qty
    where id = p_variant_id and stock_qty is not null;
end;
$$;

grant execute on function reserve_shop_stock(uuid, integer) to service_role;
grant execute on function release_shop_stock(uuid, integer) to service_role;
