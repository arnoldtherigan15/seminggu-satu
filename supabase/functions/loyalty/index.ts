// Port dari doGet?page=loyalty -- cek loyalty publik via nomor WA (JSONP di
// versi lama, sekarang JSON biasa). TANPA data sensitif.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { loyaltyMembers } from "../_shared/queries.ts";

const LOYALTY_TARGET = 6;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const wa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const key = waKey(wa);
    if (!key) return jsonResponse({ found: false, reason: "empty" });

    const admin = supabaseAdmin();
    const members = await loyaltyMembers(admin);
    const m = members.find((x) => x.key === key);
    if (!m) return jsonResponse({ found: false });

    let nameMap: Record<string, string> = {};
    try {
      const { data: cfgRow } = await admin.from("app_config").select("value").eq("key", "WORKSHOPS_JSON").maybeSingle();
      const cfg = JSON.parse(cfgRow?.value || "[]");
      for (const w of cfg) if (w?.id) nameMap[w.id] = w.name;
    } catch (_e) { /* abaikan */ }

    return jsonResponse({
      found: true,
      nickname: m.nickname || m.fullName || "",
      count: m.count,
      progress: m.progress,
      claimed: m.claimed,
      eligible: m.eligible,
      questCount: m.questCount,
      target: LOYALTY_TARGET,
      events: m.events.map((ev) => ({ name: nameMap[ev.workshop] || ev.workshop || "Workshop", eventDate: ev.eventDate, label: ev.label, date: ev.date })),
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
