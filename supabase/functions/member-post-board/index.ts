// Port dari memberPostBoard_() -- nempel pesan di Mading Warga, kuota 2/hari.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

const BOARD_DAILY_LIMIT = 2;

function jakartaDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const text = String(data.text || "").trim().slice(0, 140);
    if (text.length < 3) return errorResponse("Pesannya kependekan 😅 Tulis yang manis ya.");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa, nickname").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const today = jakartaDateStr(new Date());
    const { data: mineToday } = await admin
      .from("board_messages")
      .select("created_at")
      .eq("wa", prof.wa)
      .order("created_at", { ascending: false })
      .limit(20);
    const countToday = (mineToday || []).filter((r) => jakartaDateStr(new Date(r.created_at)) === today).length;
    if (countToday >= BOARD_DAILY_LIMIT) {
      return errorResponse("Kuota nempel pesanmu hari ini habis (2/hari). Besok lagi ya! 🌙");
    }

    const { error } = await admin.from("board_messages").insert({ wa: prof.wa, nickname: prof.nickname, message: text });
    if (error) return errorResponse("Gagal nempel pesan, coba lagi ya.", 500);

    return jsonResponse({ status: "success", message: "Pesanmu nempel di Mading Warga! 📌" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
