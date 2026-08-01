// List postingan Barter Warga + sisa kuota minggu ini. Section terpisah
// dari Mading -- warga tukeran barang, bukan pesan semangat. Auto-expire
// >7 hari (sama pola kayak board/index.ts) biar section-nya tetep fresh.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { memberNickMap } from "../_shared/queries.ts";

const BARTER_WEEKLY_LIMIT = 2;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const myWa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const myKey = waKey(myWa);

    const admin = supabaseAdmin();

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    try { await admin.from("barter_posts").delete().lt("created_at", weekAgo); } catch (_e) { /* abaikan */ }

    const { data: rows, error } = await admin
      .from("barter_posts")
      .select("id, wa, nickname, item_text, photo_url, status, created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return errorResponse("Gagal ambil data barter: " + error.message, 500);
    const nickMap = await memberNickMap(admin);

    const items = (rows || []).map((r) => ({
      id: r.id,
      wa: r.wa,
      nickname: nickMap[waKey(r.wa)] || r.nickname || "Warga",
      text: r.item_text,
      photo: r.photo_url,
      done: r.status === "done",
      ts: r.created_at ? new Date(r.created_at).getTime() : 0,
      expiresAt: r.created_at ? new Date(r.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 : 0,
    }));

    let left = BARTER_WEEKLY_LIMIT;
    if (myKey) {
      const { data: mine } = await admin.from("barter_posts").select("id").eq("wa", myKey).gte("created_at", weekAgo);
      left = Math.max(0, BARTER_WEEKLY_LIMIT - (mine || []).length);
    }

    return jsonResponse({ items, left });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
