// Endpoint publik -- bikin pesanan baru dari toko.html. Satu request = cart
// + alamat + bukti transfer sekaligus (sama pola kayak register-workshop:
// customer transfer dulu [harga udah fix dari keranjang], baru submit
// form+bukti dalam 1 kali kirim -- bukan dua tahap terpisah).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { genOrderCode, reservedUntilIso } from "../_shared/shop.ts";

interface CartLine { productId: string; variantId?: string; quantity: number }

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const waK = waKey(data.wa);
    if (!waK) return errorResponse("Nomor WhatsApp nggak valid.");
    const customerName = String(data.customerName || "").trim();
    if (!customerName) return errorResponse("Nama penerima wajib diisi.");

    const lines = Array.isArray(data.items) ? (data.items as CartLine[]) : [];
    if (!lines.length) return errorResponse("Keranjang masih kosong.");

    const shippingAddress = data.shippingAddress && typeof data.shippingAddress === "object" ? data.shippingAddress : {};
    if (!shippingAddress.address || !shippingAddress.recipient || !shippingAddress.phone) {
      return errorResponse("Alamat pengiriman belum lengkap.");
    }
    if (!data.paymentBase64) return errorResponse("Upload bukti transfer dulu ya.");

    const admin = supabaseAdmin();

    const productIds = [...new Set(lines.map((l) => l.productId))];
    const { data: products } = await admin.from("shop_products").select("*").in("id", productIds).eq("active", true);
    const productById = new Map((products || []).map((p) => [p.id, p]));

    const variantIds = lines.map((l) => l.variantId).filter(Boolean) as string[];
    const { data: variants } = variantIds.length
      ? await admin.from("shop_product_variants").select("*").in("id", variantIds)
      : { data: [] };
    const variantById = new Map((variants || []).map((v) => [v.id, v]));

    // Validasi + reservasi stok SATU PER SATU lewat reserve_shop_stock() (RPC
    // atomik di DB) -- kalau ada baris yang gagal di tengah jalan, lepas lagi
    // yang udah kebagian sebelumnya biar nggak nyangkut "stok ke-reserve tapi
    // pesanannya sendiri gagal dibuat".
    const reserved: { variantId: string; qty: number }[] = [];
    const items: Record<string, unknown>[] = [];
    let subtotal = 0;

    try {
      for (const line of lines) {
        const qty = Math.max(1, Number(line.quantity) || 1);
        const product = productById.get(line.productId);
        if (!product) throw new Error("Ada produk di keranjang yang udah nggak tersedia.");

        let variant = null as Record<string, unknown> | null;
        if (line.variantId) {
          variant = variantById.get(line.variantId) || null;
          if (!variant || variant.product_id !== product.id || !variant.active) {
            throw new Error(`Varian untuk "${product.name}" udah nggak tersedia.`);
          }
          if (variant.stock_qty != null) {
            const { data: ok } = await admin.rpc("reserve_shop_stock", { p_variant_id: variant.id, p_qty: qty });
            if (!ok) throw new Error(`Stok "${product.name} - ${variant.label}" nggak cukup (sisa kurang dari ${qty}).`);
            reserved.push({ variantId: variant.id as string, qty });
          }
        }

        const unitPrice = variant?.price_override != null ? Number(variant.price_override) : Number(product.base_price) || 0;
        subtotal += unitPrice * qty;
        items.push({
          product_id: product.id,
          variant_id: variant?.id || null,
          product_name_snapshot: product.name,
          variant_label_snapshot: variant?.label || "",
          unit_price_snapshot: unitPrice,
          quantity: qty,
        });
      }
    } catch (e) {
      for (const r of reserved) await admin.rpc("release_shop_stock", { p_variant_id: r.variantId, p_qty: r.qty });
      return errorResponse((e as Error).message || "Gagal memproses keranjang.");
    }

    const includesCommunityBundle = !!data.includesCommunityBundle;
    let kitSessionId: string | null = null;
    if (includesCommunityBundle) {
      kitSessionId = String(data.kitSessionId || "") || null;
      if (!kitSessionId) {
        for (const r of reserved) await admin.rpc("release_shop_stock", { p_variant_id: r.variantId, p_qty: r.qty });
        return errorResponse("Pilih jadwal sesi Zoom dulu buat opsi Kit + Akses Komunitas.");
      }
    }

    const shippingCost = Math.max(0, Number(data.shippingCost) || 0); // Fase 1: belum ada API ongkir, admin isi manual/placeholder
    const total = subtotal + shippingCost;

    let proofUrl = "";
    try {
      proofUrl = await uploadBase64(admin, "payment-proofs", data.paymentBase64, "shop-order");
    } catch (_e) {
      for (const r of reserved) await admin.rpc("release_shop_stock", { p_variant_id: r.variantId, p_qty: r.qty });
      return errorResponse("Gagal upload bukti transfer, coba lagi ya.");
    }

    const orderCode = genOrderCode();
    const { data: order, error } = await admin.from("shop_orders").insert({
      order_code: orderCode,
      customer_wa: waK,
      customer_name: customerName,
      shipping_address: shippingAddress,
      shipping_cost: shippingCost,
      subtotal,
      total,
      status: "pending_review",
      payment_proof_url: proofUrl || null,
      kit_session_id: kitSessionId,
      includes_community_bundle: includesCommunityBundle,
      reserved_until: reservedUntilIso(),
    }).select().single();

    if (error || !order) {
      for (const r of reserved) await admin.rpc("release_shop_stock", { p_variant_id: r.variantId, p_qty: r.qty });
      return errorResponse("Gagal menyimpan pesanan, coba lagi ya.");
    }

    await admin.from("shop_order_items").insert(items.map((it) => ({ ...it, order_id: order.id })));

    return jsonResponse({ status: "success", orderCode, orderId: order.id, total });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
