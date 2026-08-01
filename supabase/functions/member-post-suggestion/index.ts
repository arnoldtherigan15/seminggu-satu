// Port dari memberPostSuggestion_() -- kirim usul ke Kotak Pos, kuota 2/hari.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

const SUGGEST_CATS = ["challenge", "surat", "fitur"];
const SUGGEST_CAT_LABEL: Record<string, string> = { challenge: "Challenge", surat: "Surat Bulanan", fitur: "Fitur Baru" };
const SUGGEST_DAILY_LIMIT = 2;

function jakartaDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const category = String(data.category || "");
    if (!SUGGEST_CATS.includes(category)) return errorResponse("Kategorinya pilih dulu ya.");
    const text = String(data.text || "").trim().slice(0, 200);
    if (text.length < 5) return errorResponse("Usulannya kependekan 😅 ceritain dikit lagi.");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa, nickname").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const today = jakartaDateStr(new Date());
    const { data: mineToday } = await admin
      .from("suggestions")
      .select("created_at")
      .eq("wa", prof.wa)
      .order("created_at", { ascending: false })
      .limit(20);
    const countToday = (mineToday || []).filter((r) => jakartaDateStr(new Date(r.created_at)) === today).length;
    if (countToday >= SUGGEST_DAILY_LIMIT) {
      return errorResponse(`Kuota kirim usulanmu hari ini habis (${SUGGEST_DAILY_LIMIT}/hari). Besok lagi ya! 🌙`);
    }

    const { data: inserted, error } = await admin
      .from("suggestions")
      .insert({ wa: prof.wa, nickname: prof.nickname, category, message: text })
      .select("id")
      .single();
    if (error || !inserted) return errorResponse("Gagal kirim usulan, coba lagi ya.", 500);

    // Notif Telegram -- best-effort, jangan gagalin submit kalau ini error
    try {
      await sendTelegramText(
        "📮 *Kotak Pos Baru!*\n\n" +
          `🏷️ Kategori: ${SUGGEST_CAT_LABEL[category] || category}\n` +
          `👤 Dari: ${prof.nickname || "Sahabat"}\n` +
          `💬 Usulan: ${text}`,
      );
    } catch (_e) { /* abaikan */ }

    return jsonResponse({ status: "success", message: "Usulanmu masuk Kotak Pos! 📮", id: inserted.id });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
