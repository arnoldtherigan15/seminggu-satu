// Port dari memberEditQuest_() -- ganti foto/caption submission yang UDAH ada
// (bukan bikin baru).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const challengeId = String(data.challengeId || "");
    if (!challengeId) return errorResponse("Challenge tidak valid.");
    if (!data.photoBase64) return errorResponse("Fotonya belum dipilih.");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa, nickname").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const { data: existing } = await admin
      .from("quest_submissions")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("wa", prof.wa)
      .maybeSingle();
    if (!existing) return errorResponse("Kamu belum ikut challenge ini.");

    const photoUrl = await uploadBase64(admin, "quest-photos", data.photoBase64, `quest-${challengeId}-${prof.wa}`, data.photoMime);
    if (!photoUrl) return errorResponse("Gagal upload foto, coba lagi ya.");

    // deno-lint-ignore no-explicit-any
    const patch: Record<string, any> = { photo_url: photoUrl };
    if (data.caption !== undefined) patch.caption = String(data.caption || "").slice(0, 280);

    await admin.from("quest_submissions").update(patch).eq("id", existing.id);

    return jsonResponse({ status: "success", message: "Foto kesimpen! 📸" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
