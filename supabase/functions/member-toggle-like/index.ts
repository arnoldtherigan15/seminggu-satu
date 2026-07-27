// Port dari memberToggleLike_() -- like polymorphic: target_id bisa nunjuk
// quest_submissions, event_photos, ATAU key sintetis check-in mingguan.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const targetId = String(data.submissionId || "");
    if (!targetId) return errorResponse("Data tidak valid.");

    const admin = supabaseAdmin();
    const { data: prof } = await admin.from("members").select("wa").eq("token", token).maybeSingle();
    if (!prof) return errorResponse("Sesi tidak valid, login lagi ya.");

    const { data: existing } = await admin
      .from("quest_likes")
      .select("*")
      .eq("target_id", targetId)
      .eq("wa", prof.wa)
      .maybeSingle();

    let liked: boolean;
    if (existing) {
      await admin.from("quest_likes").delete().eq("target_id", targetId).eq("wa", prof.wa);
      liked = false;
    } else {
      await admin.from("quest_likes").insert({ target_id: targetId, wa: prof.wa });
      liked = true;
    }

    const { count } = await admin
      .from("quest_likes")
      .select("target_id", { count: "exact", head: true })
      .eq("target_id", targetId);

    return jsonResponse({ status: "success", liked, likes: count ?? 0 });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
