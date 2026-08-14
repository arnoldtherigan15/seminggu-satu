// Post foto journal pribadi ke "Selipan Jurnal" di Mading -- foto WAJIB
// (ini pajangan halaman jurnal, beda dari sticky note yang teks doang),
// caption opsional. Beda dari board_messages/barter_posts: BUKAN kuota
// harian/mingguan, tapi max 1 postingan AKTIF per warga -- warga musti
// hapus punya lama dulu (lewat member-delete-journal) baru bisa post baru.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const caption = String(data.caption || "").trim().slice(0, 140);
    if (!data.photoBase64) return errorResponse("Foto halaman jurnalnya belum ada nih 📸");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa, nickname").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: mineActive } = await admin
      .from("mading_journal_posts")
      .select("id")
      .eq("wa", prof.wa)
      .gte("created_at", weekAgo)
      .limit(1);
    if ((mineActive || []).length) {
      return errorResponse("Kamu masih punya 1 Selipan Jurnal yang aktif di Mading. Hapus dulu yang lama sebelum share yang baru ya 📖");
    }

    const photoUrl = await uploadBase64(admin, "mading-journal-photos", data.photoBase64, `journal-${prof.wa}`, data.photoMime);

    const { error } = await admin.from("mading_journal_posts").insert({ wa: prof.wa, nickname: prof.nickname, caption, photo_url: photoUrl });
    if (error) return errorResponse("Gagal share Selipan Jurnal, coba lagi ya.", 500);

    return jsonResponse({ status: "success", message: "Halaman jurnalmu udah nempel di Mading! 📖" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
