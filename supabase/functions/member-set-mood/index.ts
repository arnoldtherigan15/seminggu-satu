// Port dari memberSetMood_() -- simpen mood harian warga (buat cuaca/mood
// komunitas di /balai).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

const MOOD_KEYS = ["cerah", "berawan", "hujan", "badai", "pelangi"];

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const mood = String(data.mood || "");
    if (!MOOD_KEYS.includes(mood)) return errorResponse("Mood tidak dikenal.");

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("wa, mood_records").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi tidak valid, login lagi ya.");

    const now = new Date();
    const jakartaParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const y = jakartaParts.find((p) => p.type === "year")!.value;
    const m = jakartaParts.find((p) => p.type === "month")!.value;
    const d = String(parseInt(jakartaParts.find((p) => p.type === "day")!.value, 10));
    const monthKey = `${y}-${m}`;

    const recs = { ...(row.mood_records || {}) };
    recs[monthKey] = { ...(recs[monthKey] || {}), [d]: mood };

    await admin.from("members").update({ mood_records: recs }).eq("wa", row.wa);

    return jsonResponse({ status: "success", moodRecords: JSON.stringify(recs) });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
