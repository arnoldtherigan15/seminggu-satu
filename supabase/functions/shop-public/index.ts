// Endpoint publik toko online pre-order (seminggusatu.com/shop).
//   catalog      -> produk yang di-set "Tampil di toko" + info bayar
//   searchDest   -> cari kecamatan tujuan (RajaOngkir, di-cache 30 hari)
//   ongkir       -> layanan JNE + harga buat keranjang ini (berat dihitung dari DB, cache 30 hari)
//   createOrder  -> simpan order. Harga & ongkir DIHITUNG ULANG di server, bukti
//                   transfer WAJIB, notif ke Telegram + push admin
//   track        -> status order buat halaman tracking (pakai token rahasia di link)
// Pre-order: TIDAK dibatasi / mengurangi stok.
// Nggak ada login; yang megang track_token (UUID) bisa liat order-nya, sama
// prinsip kayak sell_token / link tagihan di endpoint publik lain.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { getConfigValue } from "../_shared/config.ts";
import { waKey } from "../_shared/auth.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { sendTelegramText } from "../_shared/telegram.ts";
import { searchDestination, jneOptions, rajaKey } from "../_shared/rajaongkir.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Any = any;

const BANK_DEFAULT = { bank: "Blu by BCA Digital", number: "090163537583", holder: "Arnold Therigan" };
const STATUS_LABEL: Record<string, string> = {
  verifikasi: "Menunggu verifikasi pembayaran",
  dibayar: "Pembayaran diterima",
  diproses: "Lagi dibuat (pre-order)",
  dikirim: "Dikirim",
  selesai: "Selesai",
  batal: "Dibatalkan",
};

async function unitHpp(admin: SupabaseClient, product: Any): Promise<number> {
  const materials = Array.isArray(product.materials) ? product.materials : [];
  const extraCosts = Array.isArray(product.extra_costs) ? product.extra_costs : [];
  let materialCost = 0;
  if (materials.length) {
    const ids = materials.map((m: Any) => m.materialId).filter(Boolean);
    const { data: matRows } = await admin.from("shop_materials").select("id, purchase_qty, price").in("id", ids);
    const byId = new Map((matRows || []).map((m: Any) => [m.id, m]));
    for (const m of materials as Any[]) {
      const mat: Any = byId.get(m.materialId);
      const unit = mat && Number(mat.purchase_qty) > 0 ? Number(mat.price) / Number(mat.purchase_qty) : 0;
      materialCost += unit * (Number(m.qty) || 0);
    }
  }
  const extra = extraCosts.reduce((s: number, e: Any) => s + (Number(e.amount) || 0), 0);
  return Math.round(materialCost + extra);
}

async function bankInfo(admin: SupabaseClient) {
  try {
    const raw = await getConfigValue(admin, "SHOP_BANK_JSON");
    if (raw) { const b = JSON.parse(raw); if (b && b.number) return { ...BANK_DEFAULT, ...b }; }
  } catch (_e) { /* pakai default */ }
  return BANK_DEFAULT;
}

function publicProduct(p: Any) {
  return {
    id: p.id, code: p.code || "", name: p.name, price: Number(p.sell_price) || 0, image: p.image || "",
    weight: Number(p.weight_grams) || 150, preorderNote: p.preorder_note || "", desc: p.shop_desc || "",
  };
}

// keranjang -> produk valid (tampil di toko & ada harga), qty dibatasi wajar
async function resolveCart(admin: SupabaseClient, items: Any[]) {
  const want = new Map<string, number>();
  for (const it of Array.isArray(items) ? items : []) {
    const id = String(it?.productId || ""), q = Math.round(Number(it?.qty) || 0);
    if (!id || q <= 0) continue;
    want.set(id, Math.min(50, (want.get(id) || 0) + q));
  }
  if (!want.size) throw new Error("Keranjangnya masih kosong.");
  const { data: rows } = await admin.from("shop_products").select("*").in("id", [...want.keys()]);
  const lines: { product: Any; qty: number }[] = [];
  for (const [id, qty] of want) {
    const p = (rows || []).find((r: Any) => r.id === id);
    if (!p || !p.show_in_shop || p.sell_price == null) throw new Error("Ada produk yang udah nggak dijual. Muat ulang halamannya ya.");
    lines.push({ product: p, qty });
  }
  const subtotal = lines.reduce((s, l) => s + Number(l.product.sell_price) * l.qty, 0);
  const grams = lines.reduce((s, l) => s + (Number(l.product.weight_grams) || 150) * l.qty, 0);
  return { lines, subtotal, grams };
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const data = await req.json().catch(() => ({}));
    const action = String(data.action || "");
    const admin = supabaseAdmin();

    if (action === "catalog") {
      const { data: rows } = await admin.from("shop_products").select("*").eq("show_in_shop", true).not("sell_price", "is", null).order("created_at", { ascending: false });
      return jsonResponse({
        status: "success", products: (rows || []).map(publicProduct),
        bank: await bankInfo(admin),
        origin: await getConfigValue(admin, "SHOP_ORIGIN_LABEL"),
        ongkirReady: !!rajaKey(),
      });
    }

    if (action === "searchDest") {
      const results = await searchDestination(admin, String(data.q || ""));
      return jsonResponse({ status: "success", results });
    }

    if (action === "ongkir") {
      const destId = Number(data.destId) || 0;
      if (!destId) return errorResponse("Pilih kecamatan tujuan dulu.");
      const { grams, subtotal } = await resolveCart(admin, data.items);
      const origin = await getConfigValue(admin, "SHOP_ORIGIN_ID");
      if (!origin) return errorResponse("Alamat asal toko belum diatur.");
      const options = await jneOptions(admin, origin, destId, grams);
      if (!options.length) return errorResponse(rajaKey() ? "Ongkir ke alamat ini belum bisa dihitung. Coba pilih kecamatan lain / hubungi admin." : "Cek ongkir otomatis belum aktif. Hubungi admin lewat WA ya.");
      return jsonResponse({ status: "success", options, grams, subtotal });
    }

    if (action === "createOrder") {
      const name = String(data.name || "").trim().slice(0, 80);
      const wa = waKey(data.wa);
      const address = String(data.address || "").trim().slice(0, 400);
      const destId = Number(data.destId) || 0;
      const service = String(data.service || "").trim();
      const note = String(data.note || "").trim().slice(0, 300);
      if (!name) return errorResponse("Nama wajib diisi.");
      if (wa.length < 10) return errorResponse("Nomor WhatsApp-nya kayaknya belum bener.");
      if (address.length < 10) return errorResponse("Alamat lengkap wajib diisi (jalan, nomor rumah, RT/RW).");
      if (!destId || !service) return errorResponse("Pilih kecamatan & layanan JNE dulu.");
      if (!data.proofBase64) return errorResponse("Upload bukti transfer dulu ya.");

      const { lines, subtotal, grams } = await resolveCart(admin, data.items);
      const origin = await getConfigValue(admin, "SHOP_ORIGIN_ID");
      const options = origin ? await jneOptions(admin, origin, destId, grams) : [];
      const pick = options.find((o) => o.service === service);
      if (!pick) return errorResponse("Ongkirnya berubah / layanan nggak tersedia. Pilih ulang layanan JNE ya.");
      const destLabel = String(data.destLabel || "").slice(0, 200);

      const proof = await uploadBase64(admin, "payment-proofs", String(data.proofBase64), `shop-${name}`);
      const ref = String(data.ref || "").toLowerCase();
      const channel = ["instagram", "threads", "whatsapp"].includes(ref) ? ref : "web";
      const now = new Date().toISOString();
      const { data: order, error: oe } = await admin.from("shop_orders").insert({
        buyer_name: name, buyer_wa: wa, is_cod: false, is_paid: false,
        delivery_address: address + (destLabel ? "\n" + destLabel : ""),
        channel, source: "web", status: "verifikasi", status_updated_at: now,
        ship_dest_id: destId, ship_dest_label: destLabel, ship_service: pick.service,
        ship_cost: pick.cost, ship_etd: pick.etd, ship_weight_grams: grams,
        payment_proof: proof, buyer_note: note || null,
      }).select("*").single();
      if (oe || !order) return errorResponse("Gagal nyimpen order: " + (oe?.message || "coba lagi"), 500);

      const sales = [];
      for (const l of lines) {
        sales.push({ order_id: order.id, product_id: l.product.id, qty: l.qty, unit_sell_price: Number(l.product.sell_price), unit_hpp: await unitHpp(admin, l.product) });
      }
      const { error: se } = await admin.from("shop_sales").insert(sales);
      if (se) { await admin.from("shop_orders").delete().eq("id", order.id); return errorResponse("Gagal nyimpen item: " + se.message, 500); }

      const total = subtotal + pick.cost;
      try {
        await sendTelegramText(
          "🛍️ *Order Baru dari Toko!*\n\n" +
            `👤 Nama: ${name}\n📱 WA: ${wa}\n` +
            lines.map((l) => `• ${l.product.name} ×${l.qty}`).join("\n") + "\n" +
            `🚚 JNE ${pick.service} → ${destLabel || "-"}\n` +
            `💰 Total: Rp ${total.toLocaleString("id-ID")} (ongkir ${pick.cost.toLocaleString("id-ID")})\n` +
            "🧾 Bukti transfer: udah diupload, cek di Order toko",
        );
      } catch (_e) { /* best-effort */ }

      return jsonResponse({ status: "success", token: order.track_token, total });
    }

    if (action === "track") {
      const token = String(data.token || "");
      if (!/^[0-9a-f-]{36}$/i.test(token)) return errorResponse("Link tracking nggak valid.");
      const { data: o } = await admin.from("shop_orders").select("*").eq("track_token", token).maybeSingle();
      if (!o) return errorResponse("Order nggak ketemu.", 404);
      const { data: sales } = await admin.from("shop_sales").select("product_id, qty, unit_sell_price").eq("order_id", o.id);
      const ids = [...new Set((sales || []).map((s: Any) => s.product_id))];
      const { data: prods } = ids.length ? await admin.from("shop_products").select("id, name, image, preorder_note").in("id", ids) : { data: [] };
      const items = (sales || []).map((s: Any) => {
        const p: Any = (prods || []).find((x: Any) => x.id === s.product_id) || {};
        return { name: p.name || "Produk", image: p.image || "", preorderNote: p.preorder_note || "", qty: Number(s.qty), price: Number(s.unit_sell_price), lineTotal: Number(s.qty) * Number(s.unit_sell_price) };
      });
      const subtotal = items.reduce((s: number, i: Any) => s + i.lineTotal, 0);
      const status = o.status || (o.is_paid ? "dibayar" : "verifikasi");
      return jsonResponse({
        status: "success",
        order: {
          name: o.buyer_name, createdAt: o.created_at, status, statusLabel: STATUS_LABEL[status] || status, statusUpdatedAt: o.status_updated_at,
          items, subtotal, shipCost: Number(o.ship_cost) || 0, total: subtotal + (Number(o.ship_cost) || 0),
          shipService: o.ship_service || "", shipEtd: o.ship_etd || "", shipDest: o.ship_dest_label || "", awb: o.awb || "",
          orderNo: String(o.id).slice(0, 8).toUpperCase(),
        },
        adminWa: (await getConfigValue(admin, "SHOP_ADMIN_WA")) || "6281214574782",
      });
    }

    return errorResponse("Action tidak dikenali.");
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
