// Cron harian: pesanan Toko yang masih "pending_review" tapi udah lewat
// reserved_until dianggap hangus (nggak pernah diapprove/diupload buktinya
// sampai batas waktu) -- stok yang direservasi pas checkout dilepas balik
// biar nggak nyangkut "ke-reserve selamanya" buat pesanan yang nggak
// pernah lanjut. NGGAK butuh secret apa-apa, aman dijalanin di dev & prod.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (_req) => {
  const admin = supabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: expired } = await admin
    .from("shop_orders")
    .select("id")
    .eq("status", "pending_review")
    .lt("reserved_until", nowIso);

  let released = 0;
  for (const o of expired || []) {
    const { data: items } = await admin.from("shop_order_items").select("variant_id, quantity").eq("order_id", o.id).not("variant_id", "is", null);
    for (const it of items || []) {
      await admin.rpc("release_shop_stock", { p_variant_id: it.variant_id, p_qty: it.quantity });
    }
    await admin.from("shop_orders").update({ status: "expired" }).eq("id", o.id);
    released++;
  }

  return new Response(JSON.stringify({ status: "success", releasedOrders: released }), {
    headers: { "Content-Type": "application/json" },
  });
});
