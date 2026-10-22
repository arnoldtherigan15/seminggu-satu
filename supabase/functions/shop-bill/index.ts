// Endpoint publik -- "tagihan terbuka" (open bill) buat peserta EVENT OFFLINE
// yang checkout sendiri: scan QR produk (sell_token, SAMA token yang dipake
// shop-sell) -> nambahin item ke tagihan sendiri (order id disimpen di
// localStorage HP peserta) -> bisa nambah produk LAIN atau qty > 1 -> pas
// mau checkout, kirim rincian + link tagihan ke WA Arnold.
//
// Beda sama shop-sell (yang didesain Arnold SENDIRI scan buat 1x catat jual
// instan, nggak ada identitas pembeli, nggak bisa numpuk beberapa produk):
// di sini SATU shop_orders row dipake nampung banyak shop_sales dari banyak
// produk berbeda, checkout-nya belakangan -- order yang dihasilin di sini
// persis "order walk-in" biasa (batch_id & registration_id null), jadi
// otomatis muncul di admin Order Toko (subtab Pembeli Lain/Semua) tanpa
// perlu UI admin baru.
//
// Nggak ada login -- siapa aja yang PEGANG order id (UUID, susah ditebak)
// bisa baca/ubah tagihan itu, sama prinsipnya kayak sell_token/slug rec di
// endpoint publik lain di project ini.
//
// Stock dikurangin LANGSUNG pas item ditambahin (BUKAN direserve+expired
// kayak rencana e-commerce yang lama) -- sengaja, ini event OFFLINE, barang
// udah dibawa fisik sesuai stok, Arnold nambahin stok manual kalau meleset.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
async function computeUnitHpp(admin: SupabaseClient, product: any): Promise<number> {
  const materials = Array.isArray(product.materials) ? product.materials : [];
  const extraCosts = Array.isArray(product.extra_costs) ? product.extra_costs : [];
  let materialCost = 0;
  if (materials.length) {
    // deno-lint-ignore no-explicit-any
    const ids = materials.map((m: any) => m.materialId).filter(Boolean);
    const { data: matRows } = await admin.from("shop_materials").select("id, purchase_qty, price").in("id", ids);
    // deno-lint-ignore no-explicit-any
    const matById = new Map((matRows || []).map((m: any) => [m.id, m]));
    // deno-lint-ignore no-explicit-any
    for (const m of materials as any[]) {
      const mat = matById.get(m.materialId);
      const unitCost = mat && Number(mat.purchase_qty) > 0 ? Number(mat.price) / Number(mat.purchase_qty) : 0;
      materialCost += unitCost * (Number(m.qty) || 0);
    }
  }
  // deno-lint-ignore no-explicit-any
  const extraTotal = extraCosts.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  return Math.round(materialCost + extraTotal);
}

async function buildBillResponse(admin: SupabaseClient, orderId: string) {
  const { data: order } = await admin.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return null;
  const { data: sales } = await admin.from("shop_sales").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
  // deno-lint-ignore no-explicit-any
  const productIds = Array.from(new Set((sales || []).map((s: any) => s.product_id)));
  const { data: prodRows } = productIds.length
    ? await admin.from("shop_products").select("id, name").in("id", productIds)
    : { data: [] as { id: string; name: string }[] };
  // deno-lint-ignore no-explicit-any
  const nameById = new Map((prodRows || []).map((p: any) => [p.id, p.name]));
  // deno-lint-ignore no-explicit-any
  const items = (sales || []).map((s: any) => {
    const qty = Number(s.qty) || 0;
    const unitSellPrice = Number(s.unit_sell_price) || 0;
    return {
      id: s.id, productId: s.product_id, productName: nameById.get(s.product_id) || "(produk dihapus)",
      qty, unitSellPrice, lineTotal: qty * unitSellPrice,
    };
  });
  // deno-lint-ignore no-explicit-any
  const total = items.reduce((s: number, it: any) => s + it.lineTotal, 0);
  return {
    orderId: order.id, buyerName: order.buyer_name, buyerWa: order.buyer_wa, isPaid: !!order.is_paid,
    items, total,
  };
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const admin = supabaseAdmin();
    const body = await req.json();
    const action = String(body.action || "");

    // Rekomendasi nama -- biar peserta nggak perlu ngetik manual nama
    // lengkap, cukup pilih dari daftar peserta batch-batch AKTIF "reka-rekat"
    // (ini halaman dipakenya emang khusus event Reka Rekat). BISA lebih dari
    // satu batch aktif bersamaan (mis. Vol 4/5/6 kebuka sekaligus) -- halaman
    // ini nggak tau pembelinya dari batch yang mana, jadi digabung semua.
    // Cuma balikin full_name doang (bukan WA/data lain) -- data publik
    // seminim mungkin.
    if (action === "activeNames") {
      const { data: activeBatches } = await admin.from("batches").select("id")
        .eq("workshop_type", "reka-rekat").eq("active", true);
      const batchIds = (activeBatches || []).map((b: { id: string }) => b.id);
      if (!batchIds.length) return jsonResponse({ status: "success", names: [] });
      const { data: regs } = await admin.from("registrations").select("full_name")
        .in("batch_id", batchIds).eq("archived", false);
      // deno-lint-ignore no-explicit-any
      const names = Array.from(new Set((regs || []).map((r: any) => String(r.full_name || "").trim()).filter(Boolean)));
      return jsonResponse({ status: "success", names });
    }

    if (action === "start") {
      const { data: inserted, error } = await admin.from("shop_orders").insert({
        buyer_name: "Pembeli (belum isi nama)", buyer_wa: null, batch_id: null, registration_id: null, workshop_type: null,
      }).select("id").single();
      if (error) return errorResponse("Gagal membuat tagihan: " + error.message);
      return jsonResponse({ status: "success", orderId: inserted?.id });
    }

    if (action === "getBill") {
      const orderId = String(body.orderId || "");
      if (!orderId) return errorResponse("Tagihan tidak ditemukan.");
      const bill = await buildBillResponse(admin, orderId);
      if (!bill) return errorResponse("Tagihan tidak ditemukan.", 404);
      return jsonResponse({ status: "success", bill });
    }

    if (action === "addItem") {
      const orderId = String(body.orderId || "");
      const token = String(body.token || "");
      const qty = Number(body.qty) || 0;
      if (!orderId) return errorResponse("Tagihan tidak ditemukan.");
      if (!token) return errorResponse("Produk tidak ditemukan.");
      if (qty <= 0) return errorResponse("Jumlah harus lebih dari 0.");

      const { data: order } = await admin.from("shop_orders").select("id").eq("id", orderId).maybeSingle();
      if (!order) return errorResponse("Tagihan tidak ditemukan.", 404);

      const { data: product } = await admin.from("shop_products").select("*").eq("sell_token", token).maybeSingle();
      if (!product) return errorResponse("Produk tidak ditemukan.", 404);
      const currentStock = Number(product.stock_qty) || 0;
      if (qty > currentStock) return errorResponse(`Stok "${product.name}" cuma tersisa ${currentStock}.`);

      const unitHpp = await computeUnitHpp(admin, product);
      const unitSellPrice = product.sell_price != null ? Number(product.sell_price) : 0;

      const { error: saleErr } = await admin.from("shop_sales").insert({
        product_id: product.id, qty, unit_sell_price: unitSellPrice, unit_hpp: unitHpp, order_id: orderId,
      });
      if (saleErr) return errorResponse("Gagal menambah item: " + saleErr.message);
      const { error: stockErr } = await admin.from("shop_products").update({ stock_qty: currentStock - qty }).eq("id", product.id);
      if (stockErr) return errorResponse("Gagal update stok: " + stockErr.message);

      const bill = await buildBillResponse(admin, orderId);
      return jsonResponse({ status: "success", message: `${product.name} ditambahkan.`, bill });
    }

    if (action === "removeItem") {
      const orderId = String(body.orderId || "");
      const itemId = String(body.itemId || "");
      if (!orderId || !itemId) return errorResponse("Item tidak ditemukan.");
      const { data: sale } = await admin.from("shop_sales").select("product_id, qty, order_id").eq("id", itemId).maybeSingle();
      if (!sale || sale.order_id !== orderId) return errorResponse("Item tidak ditemukan.", 404);
      const { error } = await admin.from("shop_sales").delete().eq("id", itemId);
      if (error) return errorResponse("Gagal menghapus item: " + error.message);
      const { data: product } = await admin.from("shop_products").select("stock_qty").eq("id", sale.product_id).maybeSingle();
      if (product) {
        await admin.from("shop_products").update({ stock_qty: (Number(product.stock_qty) || 0) + Number(sale.qty) }).eq("id", sale.product_id);
      }
      const bill = await buildBillResponse(admin, orderId);
      return jsonResponse({ status: "success", bill });
    }

    if (action === "setBuyer") {
      const orderId = String(body.orderId || "");
      const buyerName = String(body.buyerName || "").trim();
      const buyerWa = body.buyerWa ? String(body.buyerWa).trim() : null;
      if (!orderId) return errorResponse("Tagihan tidak ditemukan.");
      if (!buyerName) return errorResponse("Nama wajib diisi.");
      const { error } = await admin.from("shop_orders")
        .update({ buyer_name: buyerName, buyer_wa: buyerWa, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) return errorResponse("Gagal menyimpan nama: " + error.message);
      const bill = await buildBillResponse(admin, orderId);
      return jsonResponse({ status: "success", bill });
    }

    return errorResponse("Action tidak dikenal.");
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
