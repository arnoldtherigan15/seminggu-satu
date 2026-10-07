// Endpoint publik -- ongkir beneran (RajaOngkir) buat toko.html. Dua aksi:
// "search" (cari kelurahan/kecamatan tujuan) & "cost" (hitung ongkir JNE
// dari titik asal Arnold ke tujuan yang dipilih, berdasarkan BERAT YANG
// DIHITUNG ULANG DI SERVER dari isi keranjang -- bukan dari angka client).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { getConfigValue } from "../_shared/config.ts";
import { searchDestination, calculateCost } from "../_shared/rajaongkir.ts";
import { cartWeightGrams } from "../_shared/shop.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const action = String(data.action || "");
    const apiKey = Deno.env.get("RAJAONGKIR_API_KEY");
    if (!apiKey) return errorResponse("RAJAONGKIR_API_KEY belum diset di server.");

    const admin = supabaseAdmin();

    if (action === "search") {
      const query = String(data.query || "").trim();
      if (query.length < 3) return jsonResponse({ status: "success", results: [] });
      const results = await searchDestination(apiKey, query);
      return jsonResponse({ status: "success", results });
    }

    if (action === "cost") {
      const destinationId = Number(data.destinationId) || 0;
      if (!destinationId) return errorResponse("Pilih dulu kelurahan/kecamatan tujuan.");
      const lines = Array.isArray(data.items) ? data.items : [];
      if (!lines.length) return errorResponse("Keranjang masih kosong.");

      const originId = await getConfigValue(admin, "SHOP_ORIGIN_ID");
      if (!originId) return errorResponse("Titik asal pengiriman belum diset admin.");

      const weightGrams = await cartWeightGrams(admin, lines);
      const options = await calculateCost(apiKey, originId, destinationId, weightGrams, "jne");
      if (!options.length) return errorResponse("JNE nggak tersedia buat tujuan ini, coba alamat lain atau hubungi admin.");
      return jsonResponse({ status: "success", options, weightGrams });
    }

    return errorResponse("Aksi tidak dikenal: " + action);
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
