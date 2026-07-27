// Port dari publicProfile_() -- profil publik 1 warga (buat /balai?w=<id>),
// CUMA yang opt-in.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { questGalleryBase } from "../_shared/queries.ts";
import { waKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const id = req.method === "GET" ? url.searchParams.get("id") : (await req.json()).id;
    if (!id) return jsonResponse({ found: false });

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("*").eq("public_id", id).eq("public_opt_in", true).maybeSingle();
    if (!row) return jsonResponse({ found: false });

    const key = waKey(row.wa);
    const items = await questGalleryBase(admin);
    const works = items
      .filter((it) => (it.kind === "quest" || it.kind === "weekly") && it.photo && it.ownerKey === key)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 30)
      .map((it) => ({ photo: it.photo, title: it.title }));

    const { count: eventsCount } = await admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("wa", key)
      .neq("workshop_type", "journaling-date");

    return jsonResponse({
      found: true,
      n: row.nickname || "Warga",
      p: row.photo_url || "",
      b: row.bio || "",
      karya: works.length,
      events: eventsCount ?? 0,
      works,
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
