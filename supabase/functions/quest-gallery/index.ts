// Port dari questGallery_() -- galeri side quest + weekly journal + foto
// event, dilengkapi info like per item.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { questGalleryBase, questLikeMaps } from "../_shared/queries.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const myWa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const myKey = waKey(myWa);

    const admin = supabaseAdmin();
    const [items, likes] = await Promise.all([questGalleryBase(admin), questLikeMaps(admin, myWa || undefined)]);

    const out = items.map((it) => ({
      id: it.id, kind: it.kind, challengeId: it.challengeId, title: it.title, nickname: it.nickname,
      photo: it.photo, caption: it.caption, ts: it.ts, eventDate: it.eventDate || "", avatar: it.avatar || "",
      mine: !!(it.ownerKey && it.ownerKey === myKey),
      likes: likes.count[it.id] || 0,
      liked: !!likes.mine[it.id],
    }));

    return jsonResponse({ items: out });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
