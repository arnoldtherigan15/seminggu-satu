// Endpoint publik -- "lacak pesanan" di toko/lacak.html. Cukup nomor WA,
// TANPA password (beda dari akun warga member-login/member-setup) -- biar
// pembeli yang cuma beli 1 kit doang nggak perlu bikin password cuma buat
// cek status kiriman.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const url = new URL(req.url);
    const wa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const waK = waKey(wa);
    if (!waK) return errorResponse("Nomor WhatsApp nggak valid.");

    const admin = supabaseAdmin();
    const { data: orders } = await admin
      .from("shop_orders")
      .select("id, order_code, status, subtotal, shipping_cost, total, tracking_number, reject_reason, includes_community_bundle, created_at, shipped_at")
      .eq("customer_wa", waK)
      .order("created_at", { ascending: false });

    const orderIds = (orders || []).map((o) => o.id);
    const { data: items } = orderIds.length
      ? await admin.from("shop_order_items").select("order_id, product_name_snapshot, variant_label_snapshot, unit_price_snapshot, quantity").in("order_id", orderIds)
      : { data: [] };

    const itemsByOrder: Record<string, Record<string, unknown>[]> = {};
    for (const it of items || []) {
      (itemsByOrder[it.order_id as string] ||= []).push({
        name: it.product_name_snapshot,
        variant: it.variant_label_snapshot,
        price: it.unit_price_snapshot,
        quantity: it.quantity,
      });
    }

    return jsonResponse({
      orders: (orders || []).map((o) => ({
        orderCode: o.order_code,
        status: o.status,
        subtotal: o.subtotal,
        shippingCost: o.shipping_cost,
        total: o.total,
        trackingNumber: o.tracking_number || "",
        rejectReason: o.reject_reason || "",
        includesCommunityBundle: o.includes_community_bundle,
        createdAt: o.created_at,
        shippedAt: o.shipped_at,
        items: itemsByOrder[o.id as string] || [],
      })),
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
