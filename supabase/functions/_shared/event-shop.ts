// "Produk yang Dibawa" ke satu event (tabel shop_batch_products) + berapa
// yang udah kejual DI EVENT ITU -- dipake bareng admin-api (kotak Produk
// yang Dibawa) & shop-bill (katalog pembeli ?e=<batch_id>), biar angka
// dibawa/terjual/sisa-nya selalu sama di dua sisi.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface EventShopLine {
  productId: string;
  name: string;
  code: string;
  image: string;
  sellPrice: number;
  brought: number;     // jumlah yang dibawa ke event
  sold: number;        // udah kejual di order batch ini
  stockQty: number;    // stok gudang sekarang
  available: number;   // yang masih bisa dibeli: min(sisa di event, stok gudang)
}

export async function getEventShopLines(admin: SupabaseClient, batchId: string): Promise<EventShopLine[]> {
  const { data: rows } = await admin.from("shop_batch_products").select("product_id, qty").eq("batch_id", batchId);
  if (!rows || !rows.length) return [];
  // deno-lint-ignore no-explicit-any
  const productIds = rows.map((r: any) => r.product_id);
  const { data: products } = await admin.from("shop_products")
    .select("id, name, code, image, sell_price, stock_qty").in("id", productIds);

  const soldByProduct = new Map<string, number>();
  const { data: orders } = await admin.from("shop_orders").select("id").eq("batch_id", batchId);
  // deno-lint-ignore no-explicit-any
  const orderIds = (orders || []).map((o: any) => o.id);
  if (orderIds.length) {
    const { data: sales } = await admin.from("shop_sales").select("product_id, qty")
      .in("order_id", orderIds).in("product_id", productIds);
    // deno-lint-ignore no-explicit-any
    for (const s of (sales || []) as any[]) {
      soldByProduct.set(s.product_id, (soldByProduct.get(s.product_id) || 0) + (Number(s.qty) || 0));
    }
  }

  // deno-lint-ignore no-explicit-any
  const productById = new Map((products || []).map((p: any) => [p.id, p]));
  // deno-lint-ignore no-explicit-any
  return rows.flatMap((r: any) => {
    const p = productById.get(r.product_id);
    if (!p) return [];
    const brought = Number(r.qty) || 0;
    const sold = soldByProduct.get(r.product_id) || 0;
    const stockQty = Number(p.stock_qty) || 0;
    return [{
      productId: p.id, name: p.name, code: p.code || "", image: p.image || "",
      sellPrice: p.sell_price != null ? Number(p.sell_price) : 0,
      brought, sold, stockQty,
      available: Math.max(0, Math.min(brought - sold, stockQty)),
    }];
  }).sort((a: EventShopLine, b: EventShopLine) => a.name.localeCompare(b.name));
}
