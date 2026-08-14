// Warga hapus Selipan Jurnal MILIK SENDIRI di Mading -- beda dari
// member-archive-barter (yang cuma nandain "done", karena barang barter
// masih relevan buat diliat walau udah ga available). Journal share ini
// murni personal & max 1 slot aktif, jadi hapus beneran (bukan diarsip)
// biar slotnya kebuka lagi buat post yang baru.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const id = String(data.id || "");
    if (!id) return errorResponse("Postingan tidak ditemukan.");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const { data: deleted, error } = await admin
      .from("mading_journal_posts")
      .delete()
      .eq("id", id)
      .eq("wa", prof.wa)
      .select("id")
      .maybeSingle();
    if (error) return errorResponse("Gagal hapus, coba lagi ya.", 500);
    if (!deleted) return errorResponse("Postingan nggak ditemukan atau bukan punya kamu.");

    return jsonResponse({ status: "success", message: "Selipan Jurnal kamu dicopot dari Mading." });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
