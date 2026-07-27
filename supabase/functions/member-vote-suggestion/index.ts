// Port dari memberVoteSuggestion_() -- toggle vote (dulu JSON array di 1 sel,
// sekarang tabel suggestion_votes sendiri -- anti-dobel otomatis via PK).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const suggestionId = String(data.id || "");
    if (!suggestionId) return errorResponse("Usulan tidak ditemukan.");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const { data: existing } = await admin
      .from("suggestion_votes")
      .select("*")
      .eq("suggestion_id", suggestionId)
      .eq("wa", prof.wa)
      .maybeSingle();

    let voted: boolean;
    if (existing) {
      await admin.from("suggestion_votes").delete().eq("suggestion_id", suggestionId).eq("wa", prof.wa);
      voted = false;
    } else {
      await admin.from("suggestion_votes").insert({ suggestion_id: suggestionId, wa: prof.wa });
      voted = true;
    }

    const { count } = await admin
      .from("suggestion_votes")
      .select("wa", { count: "exact", head: true })
      .eq("suggestion_id", suggestionId);

    return jsonResponse({ status: "success", votes: count ?? 0, voted });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
