// Port dari memberQuestsInfo_() -- status side quest si member (udah submit
// challenge apa aja, foto & caption masing-masing).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const wa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const key = waKey(wa);
    const out = { submitted: [] as string[], photos: {} as Record<string, string>, captions: {} as Record<string, string> };
    if (!key) return jsonResponse(out);

    const { data } = await supabaseAdmin().from("quest_submissions").select("challenge_id, photo_url, caption").eq("wa", key);
    for (const r of data || []) {
      if (!out.submitted.includes(r.challenge_id)) out.submitted.push(r.challenge_id);
      if (r.photo_url) out.photos[r.challenge_id] = r.photo_url;
      if (r.caption) out.captions[r.challenge_id] = r.caption;
    }
    return jsonResponse(out);
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
