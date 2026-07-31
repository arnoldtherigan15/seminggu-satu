// Port dari leaderboardData_() -- top poin side quest + top 5 "Teman Jurnal"
// (paling sering ikut event).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { loyaltyMembers, questPointsMap, extraPointsMap, memberNickMap } from "../_shared/queries.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const myWa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const myKey = waKey(myWa);

    const admin = supabaseAdmin();
    const members = await loyaltyMembers(admin);
    const qp = await questPointsMap(admin);
    const ep = await extraPointsMap(admin);
    const nickMap = await memberNickMap(admin);

    const scored = members
      .map((m) => ({ key: m.key, nickname: nickMap[m.key] || m.nickname || m.fullName || "Sahabat", events: m.count, quests: m.questCount, poin: (qp[m.key] || 0) + (ep[m.key] || 0) }))
      .filter((x) => x.poin > 0)
      .sort((a, b) => b.poin - a.poin || b.events - a.events);

    const top = scored.slice(0, 20).map((x, i) => ({ rank: i + 1, nickname: x.nickname, poin: x.poin, events: x.events, quests: x.quests }));

    let me = null;
    if (myKey) {
      const idx = scored.findIndex((x) => x.key === myKey);
      if (idx >= 0) me = { rank: idx + 1, nickname: scored[idx].nickname, poin: scored[idx].poin, events: scored[idx].events, quests: scored[idx].quests, total: scored.length };
    }

    const evScored = members
      .map((m) => ({ key: m.key, nickname: nickMap[m.key] || m.nickname || m.fullName || "Sahabat", events: m.count }))
      .filter((x) => x.events > 0)
      .sort((a, b) => b.events - a.events);
    const topEvents = evScored.slice(0, 5).map((x, i) => ({ rank: i + 1, nickname: x.nickname, events: x.events, me: !!(myKey && x.key === myKey) }));

    return jsonResponse({ top, me, topEvents });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
