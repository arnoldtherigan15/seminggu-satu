// Endpoint publik -- dipake halaman /shop-sell/?t=<sell_token> (yang
// dibuka begitu Arnold scan QR produk pake kamera HP). GET buat nampilin
// info produk (nama/harga/stok) sebelum konfirmasi, POST buat BENERAN
// nyatet penjualan (insert shop_sales + kurangin stok). sell_token
// berfungsi sebagai "kunci" -- siapapun yang PEGANG link/QR-nya bisa catat
// penjualan produk itu doang (sama prinsipnya kayak link batch workshop),
// nggak butuh login admin sama sekali (QR ini kan discan dari kamera HP
// biasa, bukan dari dalam app admin).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const admin = supabaseAdmin();

    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = (url.searchParams.get("t") || "").trim();
      if (!token) return errorResponse("Token tidak ditemukan.");
      const { data } = await admin.from("shop_products").select("id, name, sell_price, stock_qty").eq("sell_token", token).maybeSingle();
      if (!data) return errorResponse("Produk tidak ditemukan.", 404);
      return jsonResponse({
        status: "success",
        name: data.name,
        sellPrice: data.sell_price != null ? Number(data.sell_price) : null,
        stockQty: Number(data.stock_qty) || 0,
      });
    }

    const body = await req.json();
    const token = String(body.t || "").trim();
    const qty = Number(body.qty) || 0;
    if (!token) return errorResponse("Token tidak ditemukan.");
    if (qty <= 0) return errorResponse("Jumlah harus lebih dari 0.");

    const { data: product } = await admin.from("shop_products").select("*").eq("sell_token", token).maybeSingle();
    if (!product) return errorResponse("Produk tidak ditemukan.", 404);

    const currentStock = Number(product.stock_qty) || 0;
    if (qty > currentStock) return errorResponse(`Stok cuma tersisa ${currentStock}.`);

    // Hitung HPP SAAT INI (sama logic kayak listShopProducts di admin-api)
    // buat di-snapshot ke shop_sales -- transaksi ini FREEZE angkanya di
    // sini, nggak boleh ikut berubah kalau harga bahan berubah belakangan.
    const materials = Array.isArray(product.materials) ? product.materials : [];
    const extraCosts = Array.isArray(product.extra_costs) ? product.extra_costs : [];
    let materialCost = 0;
    if (materials.length) {
      const ids = materials.map((m: { materialId?: string }) => m.materialId).filter(Boolean);
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
    const unitHpp = Math.round(materialCost + extraTotal);
    const unitSellPrice = product.sell_price != null ? Number(product.sell_price) : 0;

    const { error: saleErr } = await admin.from("shop_sales").insert({
      product_id: product.id, qty, unit_sell_price: unitSellPrice, unit_hpp: unitHpp, order_id: null,
    });
    if (saleErr) return errorResponse("Gagal mencatat penjualan: " + saleErr.message);

    const newStock = currentStock - qty;
    const { error: stockErr } = await admin.from("shop_products").update({ stock_qty: newStock }).eq("id", product.id);
    if (stockErr) return errorResponse("Gagal update stok: " + stockErr.message);

    return jsonResponse({ status: "success", message: "Penjualan dicatat.", newStock, productName: product.name });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
