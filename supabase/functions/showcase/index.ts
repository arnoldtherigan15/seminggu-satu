// Port dari publicShowcase_() -- data agregat buat halaman publik /balai
// (jumlah warga/karya/event, profil opt-in, karya terbaru, momen resmi).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { questGalleryBase } from "../_shared/queries.ts";
import { waKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const admin = supabaseAdmin();

    const { data: allMembers, count: membersTotal } = await admin.from("members").select("wa, nickname, photo_url, bio, public_opt_in, public_id", { count: "exact" });
    const opted: Record<string, boolean> = {};
    const profiles: { id: string; n: string; p: string; b: string }[] = [];
    for (const m of allMembers || []) {
      if (!m.public_opt_in) continue;
      const k = waKey(m.wa);
      opted[k] = true;
      profiles.push({ id: m.public_id, n: m.nickname || "Warga", p: m.photo_url || "", b: m.bio || "" });
    }

    const items = await questGalleryBase(admin);
    const karyaTotal = items.filter((it) => it.kind === "quest" || it.kind === "weekly").length;
    const works = items
      .filter((it) => (it.kind === "quest" || it.kind === "weekly") && it.photo && opted[it.ownerKey])
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 12)
      .map((it) => ({ photo: it.photo, title: it.title, n: it.nickname }));
    const official = items
      .filter((it) => it.kind === "workshop" || it.kind === "reka-rekat" || it.kind === "temu-warga")
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 6)
      .map((it) => ({ photo: it.photo, title: it.title }));

    let eventsTotal = 0;
    try {
      const { data: cfgRow } = await admin.from("app_config").select("value").eq("key", "WORKSHOPS_JSON").maybeSingle();
      eventsTotal = (JSON.parse(cfgRow?.value || "[]") || []).length;
    } catch (_e) { /* abaikan */ }

    return jsonResponse({ members: membersTotal ?? 0, karya: karyaTotal, events: eventsTotal, profiles, works, official });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
