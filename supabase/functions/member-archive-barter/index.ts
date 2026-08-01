// Warga arsipin postingan barter MILIK SENDIRI (tandain "beres", bukan
// dihapus -- tetep keliatan biar warga lain tau udah nggak available lagi).
// Beda dari admin: cuma boleh ubah postingan yang wa-nya sama kayak sesi.
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

    const { data: updated, error } = await admin
      .from("barter_posts")
      .update({ status: "done" })
      .eq("id", id)
      .eq("wa", prof.wa)
      .select("id")
      .maybeSingle();
    if (error) return errorResponse("Gagal update, coba lagi ya.", 500);
    if (!updated) return errorResponse("Postingan nggak ditemukan atau bukan punya kamu.");

    return jsonResponse({ status: "success", message: "Ditandai beres! 🔄" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
