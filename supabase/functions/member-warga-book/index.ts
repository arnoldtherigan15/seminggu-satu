// Buku jurnal warga LAIN, dilihat dari dalam app (bottom sheet di story galeri).
// BEDA sama public-profile (buat /balai/, orang luar/nggak login): di sini
// yang digerbang cuma "kamu warga beneran yang lagi login" (via token), BUKAN
// public_opt_in target-nya -- karena karya/story warga itu emang udah keliatan
// ke semua warga lain lewat galeri/story tanpa gerbang apa pun, jadi ngunci
// bottom sheet ini berdasarkan opt-in cuma bikin bingung (kayak nutup pintu
// yang jendelanya udah kebuka).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { questGalleryBase } from "../_shared/queries.ts";
import { waKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const data = await req.json();
    const token = String(data.token || "");
    const publicId = String(data.publicId || "");
    if (!publicId) return jsonResponse({ found: false });

    const admin = supabaseAdmin();
    const { data: caller } = await admin.from("members").select("wa").eq("token", token).maybeSingle();
    if (!caller) return errorResponse("Sesi tidak valid, login lagi ya.");

    const { data: row } = await admin.from("members").select("*").eq("public_id", publicId).maybeSingle();
    if (!row) return jsonResponse({ found: false });

    const key = waKey(row.wa);
    const items = await questGalleryBase(admin);
    const works = items
      .filter((it) => (it.kind === "quest" || it.kind === "weekly") && it.photo && it.ownerKey === key)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 30)
      .map((it) => ({ photo: it.photo, title: it.title, caption: it.caption || "" }));

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
      bg: row.profile_bg || "",
      bgCustom: row.profile_bg_custom || "",
      karya: works.length,
      events: eventsCount ?? 0,
      works,
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
