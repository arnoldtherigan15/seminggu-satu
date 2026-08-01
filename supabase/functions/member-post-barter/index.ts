// Post barang buat barter -- section terpisah dari Mading, kuota 2/minggu.
// Foto WAJIB (ini pajangan barang, beda dari sticky note yang teks doang).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

const BARTER_WEEKLY_LIMIT = 2;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const text = String(data.text || "").trim().slice(0, 140);
    if (text.length < 5) return errorResponse("Ceritain barangnya dikit lagi ya 😅 (mau tukar apa, ada apa aja)");
    if (!data.photoBase64) return errorResponse("Foto barangnya belum ada nih 📸");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa, nickname").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: mineWeek } = await admin.from("barter_posts").select("id").eq("wa", prof.wa).gte("created_at", weekAgo);
    if ((mineWeek || []).length >= BARTER_WEEKLY_LIMIT) {
      return errorResponse(`Kuota post barter kamu minggu ini habis (${BARTER_WEEKLY_LIMIT}/minggu). Minggu depan lagi ya! 🔄`);
    }

    const photoUrl = await uploadBase64(admin, "barter-photos", data.photoBase64, `barter-${prof.wa}`, data.photoMime);

    const { error } = await admin.from("barter_posts").insert({ wa: prof.wa, nickname: prof.nickname, item_text: text, photo_url: photoUrl });
    if (error) return errorResponse("Gagal post barter, coba lagi ya.", 500);

    // Notif Telegram -- best-effort, jangan gagalin submit kalau ini error
    try {
      await sendTelegramText(
        "🔄 *Barter Baru!*\n\n" +
          `👤 Dari: ${prof.nickname || "Sahabat"}\n` +
          `📦 Barang: ${text}`,
      );
    } catch (_e) { /* abaikan */ }

    return jsonResponse({ status: "success", message: "Barter kamu udah kepasang! 🔄" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
