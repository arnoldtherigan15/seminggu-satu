// Port dari doGet?page=memberStatus.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { loyaltyMembers } from "../_shared/queries.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const wa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const waK = waKey(wa);

    const admin = supabaseAdmin();
    let isMember = false;
    let nickname = "";
    if (waK) {
      const members = await loyaltyMembers(admin);
      const m = members.find((x) => x.key === waK);
      if (m) { isMember = true; nickname = m.nickname || m.fullName || ""; }
    }

    let hasAccount = false;
    if (waK) {
      const { data: row } = await admin.from("members").select("pass_hash").eq("wa", waK).maybeSingle();
      hasAccount = !!row?.pass_hash;
    }

    return jsonResponse({ isMember, hasAccount, nickname });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
