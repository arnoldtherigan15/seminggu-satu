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
import { getConfigValue } from "../_shared/config.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getEventShopLines } from "../_shared/event-shop.ts";

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

  // Dipake halaman invoice (checkedOutAt != null) buat nunjukin ini order
  // dari event mana -- nama manusiawinya, bukan workshop_type mentah.
  let event: { batchId: string; workshopName: string; label: string; qrisImage: string } | null = null;
  if (order.batch_id) {
    const { data: batch } = await admin.from("batches").select("label, workshop_type, qris_image").eq("id", order.batch_id).maybeSingle();
    if (batch) {
      let workshopName = batch.workshop_type;
      try {
        const json = await getConfigValue(admin, "WORKSHOPS_JSON");
        const list = JSON.parse(json || "[]");
        // deno-lint-ignore no-explicit-any
        const found = (list as any[]).find((w: any) => w.id === batch.workshop_type);
        if (found?.name) workshopName = found.name;
      } catch (_e) { /* abaikan -- fallback ke workshop_type mentah */ }
      event = { batchId: order.batch_id, workshopName, label: batch.label || "", qrisImage: batch.qris_image || "" };
    }
  }

  return {
    orderId: order.id, buyerName: order.buyer_name, buyerWa: order.buyer_wa, isPaid: !!order.is_paid,
    checkedOutAt: order.checked_out_at || null, event,
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

    // Dropdown "Event" + rekomendasi nama di layar checkout -- SEMUA tipe
    // workshop (bukan cuma reka-rekat), batch mana aja yang event_date-nya
    // hari ini atau ke depan -- bukan ngandelin flag `active`, soalnya
    // Arnold nggak selalu balikin flag itu ke false begitu event-nya udah
    // lewat, jadi batch lama ikutan numpuk kalau kepake buat filter. Event
    // yang tanggalnya udah lewat nggak relevan buat self-checkout (nggak
    // ada yang lagi checkout di event yang udah selesai), makanya nggak ada
    // buffer ke belakang sama sekali.
    // Frontend yang nentuin default pilihan (match event_date = hari ini),
    // tapi daftar nama peserta-nya DIGABUNG dari SEMUA batch yang ditampilin
    // di sini -- biar nama tetep ketemu walau Event yang lagi dipilih bukan
    // yang itu (milih nama yang PAS otomatis pindahin Event-nya juga, lihat
    // frontend). Nama LENGKAP & nickname dua-duanya ditawarin, WA dibalikin
    // juga tapi CUMA buat auto-isi field WA begitu nama yang PAS kepilih.
    if (action === "getCheckoutContext") {
      const now = new Date();
      const toIso = (d: Date) => d.toISOString().slice(0, 10);
      const minDate = toIso(now);
      const maxDate = toIso(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000));

      const { data: batchRows } = await admin.from("batches")
        .select("id, workshop_type, label, event_date")
        .eq("archived", false)
        .not("event_date", "is", null)
        .gte("event_date", minDate)
        .lte("event_date", maxDate)
        .order("event_date", { ascending: true });

      // deno-lint-ignore no-explicit-any
      let workshopNames: Record<string, any> = {};
      try {
        const json = await getConfigValue(admin, "WORKSHOPS_JSON");
        const list = JSON.parse(json || "[]");
        // deno-lint-ignore no-explicit-any
        workshopNames = Object.fromEntries(list.map((w: any) => [w.id, w.name || w.id]));
      } catch (_e) { /* abaikan -- fallback ke workshop_type mentah */ }

      // deno-lint-ignore no-explicit-any
      const batches = (batchRows || []).map((b: any) => ({
        id: b.id, label: b.label || "", eventDate: b.event_date || "",
        workshopType: b.workshop_type, workshopName: workshopNames[b.workshop_type] || b.workshop_type,
      }));

      // deno-lint-ignore no-explicit-any
      const batchIds = batches.map((b: any) => b.id);
      // deno-lint-ignore no-explicit-any
      let participants: any[] = [];
      if (batchIds.length) {
        // Nomor WA peserta SENGAJA nggak diikutin di response ini -- endpoint
        // publik, dan WA orang lain nggak boleh kebuka ke sembarang pembeli
        // cuma karena ketik nama yang kebetulan cocok.
        const { data: regs } = await admin.from("registrations").select("id, full_name, nickname, batch_id")
          .in("batch_id", batchIds).eq("archived", false);
        participants = (regs || [])
          // deno-lint-ignore no-explicit-any
          .map((r: any) => ({
            id: r.id, batchId: r.batch_id,
            fullName: String(r.full_name || "").trim(), nickname: String(r.nickname || "").trim(),
          }))
          // deno-lint-ignore no-explicit-any
          .filter((p: any) => p.fullName || p.nickname);
      }

      return jsonResponse({ status: "success", batches, participants });
    }

    // ===== Belanja per EVENT (/shop-bill/?e=<batch_id>) =====
    // Satu QR per event: pembeli langsung liat produk yang Arnold bawa ke
    // event ini (shop_batch_products), pilih sendiri jumlahnya, checkout
    // sekali jalan. Event-nya udah pasti dari QR -- nggak ada dropdown event.
    if (action === "getEventShop") {
      const batchId = String(body.batchId || "");
      if (!batchId) return errorResponse("Event tidak ditemukan.");
      const { data: batch } = await admin.from("batches")
        .select("id, label, workshop_type, event_date, qris_image").eq("id", batchId).maybeSingle();
      if (!batch) return errorResponse("Event tidak ditemukan.", 404);
      let workshopName = batch.workshop_type;
      try {
        const list = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]");
        // deno-lint-ignore no-explicit-any
        const found = (list as any[]).find((w: any) => w.id === batch.workshop_type);
        if (found?.name) workshopName = found.name;
      } catch (_e) { /* fallback ke workshop_type mentah */ }
      const lines = await getEventShopLines(admin, batchId);
      // Nama peserta batch INI aja buat saran nama -- WA SENGAJA nggak ikut
      // (endpoint publik), sama kayak getCheckoutContext.
      const { data: regs } = await admin.from("registrations").select("id, full_name, nickname")
        .eq("batch_id", batchId).eq("archived", false);
      const participants = (regs || [])
        // deno-lint-ignore no-explicit-any
        .map((r: any) => ({ id: r.id, fullName: String(r.full_name || "").trim(), nickname: String(r.nickname || "").trim() }))
        // deno-lint-ignore no-explicit-any
        .filter((r: any) => r.fullName || r.nickname);
      return jsonResponse({
        status: "success",
        event: {
          batchId: batch.id, workshopType: batch.workshop_type, workshopName,
          label: batch.label || "", eventDate: batch.event_date || "", qrisImage: batch.qris_image || "",
        },
        products: lines.map(l => ({
          productId: l.productId, name: l.name, image: l.image, sellPrice: l.sellPrice, available: l.available,
        })),
        participants,
      });
    }

    // Checkout sekali jalan: bikin order (udah ketempel batch & langsung
    // checked_out) + semua item-nya. Stok divalidasi DI SINI (bukan pas
    // pembeli mencet +), biar keranjang yang lagi dipilih nggak "ngunci"
    // barang -- kalau ternyata udah keburu dibeli orang lain, balikin pesan
    // yang jelas & frontend refresh angka sisanya.
    if (action === "checkoutEvent") {
      const batchId = String(body.batchId || "");
      const buyerName = String(body.buyerName || "").trim();
      const buyerWa = body.buyerWa ? String(body.buyerWa).trim() : null;
      const registrationId = body.registrationId ? String(body.registrationId) : null;
      if (!batchId) return errorResponse("Event tidak ditemukan.");
      if (!buyerName) return errorResponse("Nama wajib diisi.");
      const wanted = new Map<string, number>();
      for (const it of (Array.isArray(body.items) ? body.items : [])) {
        const productId = String(it?.productId || "");
        const qty = Math.floor(Number(it?.qty) || 0);
        if (productId && qty > 0) wanted.set(productId, (wanted.get(productId) || 0) + qty);
      }
      if (!wanted.size) return errorResponse("Keranjang masih kosong.");

      const { data: batch } = await admin.from("batches").select("id, workshop_type").eq("id", batchId).maybeSingle();
      if (!batch) return errorResponse("Event tidak ditemukan.", 404);
      const lineById = new Map((await getEventShopLines(admin, batchId)).map(l => [l.productId, l]));
      for (const [productId, qty] of wanted) {
        const line = lineById.get(productId);
        if (!line) return errorResponse("Ada produk yang udah nggak dijual di event ini. Muat ulang halaman ya.", 409);
        if (qty > line.available) {
          return errorResponse(line.available > 0
            ? `"${line.name}" sisa ${line.available} -- kurangin jumlahnya dulu ya.`
            : `"${line.name}" udah habis -- hapus dari keranjang dulu ya.`, 409);
        }
      }

      // Cuma nempelin registration_id kalau beneran peserta batch ini.
      let regId: string | null = null;
      if (registrationId) {
        const { data: reg } = await admin.from("registrations").select("id").eq("id", registrationId).eq("batch_id", batchId).maybeSingle();
        if (reg) regId = reg.id;
      }

      const { data: order, error: ordErr } = await admin.from("shop_orders").insert({
        buyer_name: buyerName, buyer_wa: buyerWa, batch_id: batchId, workshop_type: batch.workshop_type,
        registration_id: regId, checked_out_at: new Date().toISOString(),
      }).select("id").single();
      if (ordErr || !order) return errorResponse("Gagal membuat pesanan: " + (ordErr?.message || ""));

      const { data: products } = await admin.from("shop_products").select("*").in("id", Array.from(wanted.keys()));
      // deno-lint-ignore no-explicit-any
      for (const product of (products || []) as any[]) {
        const qty = wanted.get(product.id) || 0;
        const unitHpp = await computeUnitHpp(admin, product);
        const unitSellPrice = product.sell_price != null ? Number(product.sell_price) : 0;
        const { error: saleErr } = await admin.from("shop_sales").insert({
          product_id: product.id, qty, unit_sell_price: unitSellPrice, unit_hpp: unitHpp, order_id: order.id,
        });
        if (saleErr) return errorResponse("Gagal menyimpan item: " + saleErr.message);
        await admin.from("shop_products").update({ stock_qty: (Number(product.stock_qty) || 0) - qty }).eq("id", product.id);
      }

      const bill = await buildBillResponse(admin, order.id);
      return jsonResponse({ status: "success", bill });
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

      const { data: order } = await admin.from("shop_orders").select("id, checked_out_at").eq("id", orderId).maybeSingle();
      if (!order) return errorResponse("Tagihan tidak ditemukan.", 404);
      if (order.checked_out_at) return errorResponse("Tagihan ini udah di-checkout. Scan ulang QR buat mulai tagihan baru.");

      const { data: product } = await admin.from("shop_products").select("*").eq("sell_token", token).maybeSingle();
      if (!product) return errorResponse("Produk tidak ditemukan.", 404);
      const currentStock = Number(product.stock_qty) || 0;
      if (qty > currentStock) return errorResponse(`Stok "${product.name}" cuma tersisa ${currentStock}.`);

      // Scan ulang produk yang SAMA di tagihan yang SAMA -> gabung ke baris
      // yang udah ada (qty ditambah), BUKAN bikin baris baru -- orang scan
      // ulang QR produk yang sama ngarepin qty-nya nambah, bukan muncul
      // baris duplikat kayak "x1" + "x1" padahal maksudnya "x2".
      const { data: existing } = await admin.from("shop_sales").select("id, qty")
        .eq("order_id", orderId).eq("product_id", product.id).maybeSingle();

      if (existing) {
        const { error: updErr } = await admin.from("shop_sales")
          .update({ qty: Number(existing.qty) + qty }).eq("id", existing.id);
        if (updErr) return errorResponse("Gagal menambah item: " + updErr.message);
      } else {
        const unitHpp = await computeUnitHpp(admin, product);
        const unitSellPrice = product.sell_price != null ? Number(product.sell_price) : 0;
        const { error: saleErr } = await admin.from("shop_sales").insert({
          product_id: product.id, qty, unit_sell_price: unitSellPrice, unit_hpp: unitHpp, order_id: orderId,
        });
        if (saleErr) return errorResponse("Gagal menambah item: " + saleErr.message);
      }
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
      const { data: order } = await admin.from("shop_orders").select("checked_out_at").eq("id", orderId).maybeSingle();
      if (order?.checked_out_at) return errorResponse("Tagihan ini udah di-checkout, nggak bisa diubah lagi.");
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
      const batchId = body.batchId ? String(body.batchId) : null;
      const workshopType = body.workshopType ? String(body.workshopType) : null;
      const registrationId = body.registrationId ? String(body.registrationId) : null;
      if (!orderId) return errorResponse("Tagihan tidak ditemukan.");
      if (!buyerName) return errorResponse("Nama wajib diisi.");
      // deno-lint-ignore no-explicit-any
      const patch: Record<string, any> = {
        buyer_name: buyerName, buyer_wa: buyerWa, updated_at: new Date().toISOString(),
        // setBuyer cuma kepanggil pas tombol "WA Arnold untuk Konfirmasi"
        // ditekan -- nandain tagihan ini UDAH di-checkout, biar kalau
        // link-nya dibuka lagi, shop-bill nunjukin invoice read-only,
        // bukan form checkout yang masih bisa diedit.
        checked_out_at: new Date().toISOString(),
      };
      // batchId/registrationId OPSIONAL -- diisi kalau pembeli milih Event di
      // dropdown (+ nama-nya PAS cocok sama salah satu peserta batch itu),
      // biar order ini nyambung ke "Peserta Event" di admin, bukan selalu
      // "Pembeli Lain". workshopType dikirim frontend (dropdown-nya sekarang
      // ngegabung SEMUA tipe workshop, bukan reka-rekat doang).
      if (batchId) { patch.batch_id = batchId; patch.workshop_type = workshopType; }
      if (registrationId) patch.registration_id = registrationId;
      const { error } = await admin.from("shop_orders").update(patch).eq("id", orderId);
      if (error) return errorResponse("Gagal menyimpan nama: " + error.message);
      const bill = await buildBillResponse(admin, orderId);
      return jsonResponse({ status: "success", bill });
    }

    return errorResponse("Action tidak dikenal.");
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
