// Endpoint publik -- bikin pesanan baru dari toko.html. Satu request = cart
// + alamat + bukti transfer sekaligus (sama pola kayak register-workshop:
// customer transfer dulu [harga udah fix dari keranjang], baru submit
// form+bukti dalam 1 kali kirim -- bukan dua tahap terpisah).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { genOrderCode, reservedUntilIso, cartWeightGrams } from "../_shared/shop.ts";
import { getConfigValue } from "../_shared/config.ts";
import { calculateCost } from "../_shared/rajaongkir.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

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
    if (!shippingAddress.address || !shippingAddress.recipient || !shippingAddress.phone || !shippingAddress.destinationId) {
      return errorResponse("Alamat pengiriman belum lengkap -- pilih kelurahan/kecamatan tujuan dulu.");
    }
    const courierService = String(data.courierService || "");
    if (!courierService) return errorResponse("Pilih dulu layanan JNE-nya (REG/YES/dst).");
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

    // Ongkir DIHITUNG ULANG di server (origin + berat dari DB, bukan dari
    // client) -- JANGAN pernah percaya shippingCost kiriman client buat
    // nentuin total tagihan.
    const apiKey = Deno.env.get("RAJAONGKIR_API_KEY");
    const originId = apiKey ? await getConfigValue(admin, "SHOP_ORIGIN_ID") : null;
    let shippingCost = 0;
    if (apiKey && originId) {
      const weightGrams = await cartWeightGrams(admin, lines);
      const options = await calculateCost(apiKey, originId, Number(shippingAddress.destinationId), weightGrams, "jne");
      const chosen = options.find((o) => o.service === courierService);
      if (!chosen) {
        for (const r of reserved) await admin.rpc("release_shop_stock", { p_variant_id: r.variantId, p_qty: r.qty });
        return errorResponse("Layanan JNE yang dipilih udah nggak tersedia, coba hitung ongkir ulang ya.");
      }
      shippingCost = chosen.cost;
    }
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
      shipping_service: courierService,
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

    // Notif Telegram -- best-effort, jangan gagalin pesanan yang udah sukses
    // kesimpen cuma gara-gara ini (sama pola kayak member-setup).
    try {
      const itemLines = items.map((it) =>
        `  • ${it.product_name_snapshot}${it.variant_label_snapshot ? " - " + it.variant_label_snapshot : ""} x${it.quantity}`
      ).join("\n");
      await sendTelegramText(
        "🛍️ *Pesanan Toko Baru!*\n\n" +
          `Kode: ${orderCode}\n` +
          `👤 ${customerName}\n` +
          `📱 ${waK}\n\n` +
          `${itemLines}\n\n` +
          `Subtotal: Rp ${subtotal.toLocaleString("id-ID")}\n` +
          `Ongkir: Rp ${shippingCost.toLocaleString("id-ID")}\n` +
          `*Total: Rp ${total.toLocaleString("id-ID")}*` +
          (includesCommunityBundle ? "\n\n✨ Termasuk Kit + Akses Komunitas" : ""),
      );
    } catch (_e) { /* abaikan */ }

    return jsonResponse({ status: "success", orderCode, orderId: order.id, total });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
