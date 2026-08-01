// Port dari boardData_() -- Mading Warga: list pesan terbaru + sisa kuota
// nempel pesan hari ini (2/hari) buat wa yang minta.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { memberNickMap } from "../_shared/queries.ts";

const BOARD_DAILY_LIMIT = 2;

function jakartaDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const myWa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const myKey = waKey(myWa);

    const admin = supabaseAdmin();

    // Mading tetap fresh -- pesan lebih dari seminggu di-auto-delete (best-effort,
    // numpang lewat tiap kali ada yang buka board, ga perlu cron terpisah)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    try { await admin.from("board_messages").delete().lt("created_at", weekAgo); } catch (_e) { /* abaikan */ }

    const { data: rows } = await admin
      .from("board_messages")
      .select("id, wa, nickname, message, created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(30);
    const nickMap = await memberNickMap(admin);

    const items = (rows || []).map((r) => ({
      id: r.id,
      nickname: nickMap[waKey(r.wa)] || r.nickname || "Warga",
      text: r.message,
      ts: r.created_at ? new Date(r.created_at).getTime() : 0,
    }));

    let left = BOARD_DAILY_LIMIT;
    if (myKey) {
      const today = jakartaDateStr(new Date());
      const { data: mine } = await admin.from("board_messages").select("created_at").eq("wa", myKey).order("created_at", { ascending: false }).limit(20);
      const countToday = (mine || []).filter((r) => jakartaDateStr(new Date(r.created_at)) === today).length;
      left = Math.max(0, BOARD_DAILY_LIMIT - countToday);
    }

    return jsonResponse({ items, left });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
