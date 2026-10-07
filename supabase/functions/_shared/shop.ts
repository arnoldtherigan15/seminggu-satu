// Helper bareng buat Toko -- dipake shop-create-order, shop-ongkir & admin-api
// (reviewShopOrder).
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

interface CartLineForWeight { productId: string; quantity: number }

// Total berat (gram) keranjang, DIHITUNG ULANG dari DB tiap kali -- jangan
// pernah percaya berat yang dikirim client (sama alasan harga/stok nggak
// pernah dipercaya dari client), karena ini langsung nentuin ongkir yang
// ditagih ke pembeli.
export async function cartWeightGrams(admin: SupabaseClient, lines: CartLineForWeight[]): Promise<number> {
  const ids = [...new Set(lines.map((l) => l.productId))];
  if (!ids.length) return 0;
  const { data: products } = await admin.from("shop_products").select("id, weight_grams").in("id", ids);
  const weightById = new Map((products || []).map((p) => [p.id, Number(p.weight_grams) || 150]));
  return lines.reduce((sum, l) => sum + (weightById.get(l.productId) || 150) * Math.max(1, l.quantity), 0);
}

// "SS-20261007-AB3F" -- kode pesanan yang gampang disebut manusia (chat
// WA/konfirmasi transfer), bukan UUID mentah.
export function genOrderCode(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `SS-${ymd}-${rand}`;
}

// Berapa lama stok direservasi sebelum pesanan yang belum diupload bukti
// bayarnya dianggap hangus (dilepas balik oleh cron-release-expired-shop-orders).
export const RESERVE_MINUTES = 60 * 24; // 24 jam

export function reservedUntilIso(): string {
  return new Date(Date.now() + RESERVE_MINUTES * 60 * 1000).toISOString();
}
