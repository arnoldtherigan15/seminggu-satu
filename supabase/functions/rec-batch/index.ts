// Endpoint publik -- baca SATU koleksi rekomendasi by slug, dipake halaman
// share /rec/?s=<slug> (link/QR yang Arnold bagiin). Beda dari konten
// Rekomendasi Alat & Bahan yang satu-satunya & global (recommendation.html) --
// ini bisa banyak koleksi terpisah, tiap satu punya slug/judul/item sendiri.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") || "").trim();
    if (!slug) return errorResponse("Slug tidak ditemukan.");

    const admin = supabaseAdmin();
    const { data } = await admin.from("rec_batches").select("*").eq("slug", slug).eq("active", true).maybeSingle();
    if (!data) return errorResponse("Koleksi tidak ditemukan atau sudah tidak aktif.", 404);

    return jsonResponse({
      status: "success",
      title: data.title,
      description: data.description || "",
      items: Array.isArray(data.items) ? data.items : [],
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
