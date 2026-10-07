// Endpoint publik -- katalog produk aktif + varian aktifnya, buat toko.html.
// Sama kehati-hatian kayak workshop-batches: jangan pernah nawarin varian
// yang udah di-nonaktifin atau stoknya abis sebagai bisa dipesan.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = supabaseAdmin();

  const { data: products } = await admin
    .from("shop_products")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const { data: variants } = await admin
    .from("shop_product_variants")
    .select("*")
    .eq("active", true);

  const { data: sessions } = await admin
    .from("shop_kit_sessions")
    .select("*")
    .eq("active", true)
    .order("session_at", { ascending: true });

  const variantsByProduct: Record<string, Record<string, unknown>[]> = {};
  for (const v of variants || []) {
    const sold = v.stock_qty != null && v.stock_qty <= 0;
    (variantsByProduct[v.product_id] ||= []).push({
      id: v.id,
      label: v.label,
      price: v.price_override != null ? Number(v.price_override) : null, // null = ikut base_price produk
      stockQty: v.stock_qty,
      isPreorder: v.is_preorder || v.stock_qty == null,
      soldOut: sold,
    });
  }

  const todayIso = new Date().toISOString();
  const kitSessions = (sessions || [])
    .filter((s) => !s.session_at || s.session_at >= todayIso)
    .map((s) => ({ id: s.id, label: s.label, sessionAt: s.session_at, maxQuota: s.max_quota }));

  const kitSessionIds = kitSessions.map((s) => s.id as string);
  const quotaUsed: Record<string, number> = {};
  if (kitSessionIds.length) {
    const { data: orderCounts } = await admin
      .from("shop_orders")
      .select("kit_session_id")
      .in("kit_session_id", kitSessionIds)
      .in("status", ["pending_review", "approved", "shipped", "completed"]);
    for (const o of orderCounts || []) {
      quotaUsed[o.kit_session_id as string] = (quotaUsed[o.kit_session_id as string] || 0) + 1;
    }
  }

  const items = (products || []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    imageUrl: p.image_url,
    basePrice: Number(p.base_price) || 0,
    isKit: !!p.is_kit,
    variants: variantsByProduct[p.id] || [],
  }));

  return jsonResponse({
    products: items,
    kitSessions: kitSessions.map((s) => ({
      ...s,
      remaining: s.maxQuota != null ? Math.max(0, (s.maxQuota as number) - (quotaUsed[s.id as string] || 0)) : null,
    })),
  });
});
