// List postingan "Selipan Jurnal" di Mading Warga -- warga share foto
// journal pribadi (buku sendiri, bukan tema drive bersama), TERPISAH dari
// Challenge/poin/leaderboard, murni opt-in. Auto-expire >7 hari, sama pola
// kayak board/index.ts & barter/index.ts biar konsisten sama rules Mading
// yang udah ada. Max 1 postingan AKTIF per warga (bukan kuota harian) --
// dicek lewat `mine` (id postingan aktif milik `wa` yang minta, kalau ada).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { memberNickMap } from "../_shared/queries.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const myWa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const myKey = waKey(myWa);

    const admin = supabaseAdmin();

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    try { await admin.from("mading_journal_posts").delete().lt("created_at", weekAgo); } catch (_e) { /* abaikan */ }

    const { data: rows, error } = await admin
      .from("mading_journal_posts")
      .select("id, wa, nickname, caption, photo_url, created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return errorResponse("Gagal ambil data Selipan Jurnal: " + error.message, 500);
    const nickMap = await memberNickMap(admin);

    const items = (rows || []).map((r) => ({
      id: r.id,
      wa: r.wa,
      nickname: nickMap[waKey(r.wa)] || r.nickname || "Warga",
      caption: r.caption || "",
      photo: r.photo_url,
      ts: r.created_at ? new Date(r.created_at).getTime() : 0,
      expiresAt: r.created_at ? new Date(r.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 : 0,
      mine: !!(myKey && waKey(r.wa) === myKey),
    }));

    const mineActive = myKey ? items.some((it) => it.mine) : false;

    return jsonResponse({ items, canPost: !mineActive });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
