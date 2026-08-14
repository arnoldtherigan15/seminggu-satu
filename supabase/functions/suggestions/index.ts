// Port dari suggestionsData_() -- daftar usul + status vote/kuota buat wa
// yang minta.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";

const SUGGEST_DAILY_LIMIT = 2;

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

    // Usulan yang UDAH disetujui admin auto-kehapus 7 hari setelah approved
    // (bukan dari created_at) -- kasih jeda biar badge "Disetujui" sempat
    // keliatan dulu sebelum dibersihin. Usulan yang belum di-approve nggak
    // expire, nunggu admin approve/tolak manual.
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    try { await admin.from("suggestions").delete().eq("status", "approved").lt("approved_at", weekAgo); } catch (_e) { /* abaikan */ }

    const { data: rows } = await admin
      .from("suggestions")
      .select("id, wa, nickname, category, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    const { data: votes } = await admin.from("suggestion_votes").select("suggestion_id, wa");

    const voteCount: Record<string, number> = {};
    const votedBy: Record<string, Set<string>> = {};
    for (const v of votes || []) {
      voteCount[v.suggestion_id] = (voteCount[v.suggestion_id] || 0) + 1;
      (votedBy[v.suggestion_id] ||= new Set()).add(waKey(v.wa));
    }

    const items = (rows || []).map((r) => ({
      id: r.id,
      nickname: r.nickname || "Warga",
      category: r.category,
      text: r.message,
      votes: voteCount[r.id] || 0,
      voted: !!(myKey && votedBy[r.id]?.has(myKey)),
      mine: !!(myKey && waKey(r.wa) === myKey),
      approved: r.status === "approved",
      ts: r.created_at ? new Date(r.created_at).getTime() : 0,
    }));

    let left = SUGGEST_DAILY_LIMIT;
    if (myKey) {
      const today = jakartaDateStr(new Date());
      const todayMine = (rows || []).filter((r) => waKey(r.wa) === myKey && jakartaDateStr(new Date(r.created_at)) === today).length;
      left = Math.max(0, SUGGEST_DAILY_LIMIT - todayMine);
    }

    return jsonResponse({ items, left });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
