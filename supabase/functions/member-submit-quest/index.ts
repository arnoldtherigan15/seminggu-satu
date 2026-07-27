// Port dari memberSubmitQuest_() -- submit foto/caption buat 1 side quest
// challenge. Foto opsional. Notif Telegram + push ke warga lain (best-effort).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { sendTelegramText } from "../_shared/telegram.ts";
import { sendPush } from "../_shared/push.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const challengeId = String(data.challengeId || "");
    if (!challengeId) return errorResponse("Challenge tidak valid.");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa, nickname").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const { data: already } = await admin
      .from("quest_submissions")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("wa", prof.wa)
      .maybeSingle();
    if (already) return errorResponse("Kamu udah ikut challenge ini 😊");

    let photoUrl = "";
    if (data.photoBase64) {
      photoUrl = await uploadBase64(admin, "quest-photos", data.photoBase64, `quest-${challengeId}-${prof.wa}`, data.photoMime);
    }
    const caption = String(data.caption || "").slice(0, 280);
    const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const { error } = await admin.from("quest_submissions").insert({
      id, challenge_id: challengeId, wa: prof.wa, nickname: prof.nickname, photo_url: photoUrl || null, caption,
    });
    if (error) return errorResponse("Gagal kirim challenge, coba lagi ya.", 500);

    // Notif Telegram + push ke warga lain -- best-effort
    try {
      const { data: chal } = await admin.from("challenges").select("title").eq("id", challengeId).maybeSingle();
      const chalTitle = chal?.title || challengeId;
      const { count: total } = await admin
        .from("quest_submissions")
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", challengeId);

      await sendTelegramText(
        "⚡ *Challenge Submission Baru!*\n\n" +
          `🎨 Challenge: ${chalTitle}\n` +
          `👤 Member: ${prof.nickname || "-"}\n` +
          `📱 WA: ${prof.wa || "-"}\n` +
          (photoUrl ? "📸 Foto: ada (masuk galeri)\n" : "📸 Foto: tidak ada\n") +
          (caption ? `💬 Caption: "${caption}"\n` : "") +
          `📊 Total peserta challenge ini: *${total ?? "?"}*`,
      );

      await sendPush(
        "🎨 Karya baru di Balai Warga!",
        `${prof.nickname || "Warga"} baru setor karya buat challenge "${chalTitle}" — intip di galeri yuk!`,
        "https://seminggusatu.com/warga/#gallery",
        prof.wa,
      );
    } catch (_e) { /* abaikan */ }

    return jsonResponse({ status: "success", message: "Challenge kekirim! 🎉" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
