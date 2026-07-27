// Port dari balaiWeather_() -- cuaca/mood komunitas 7 hari terakhir (buat
// /balai).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

const MOOD_KEYS = ["cerah", "berawan", "hujan", "badai", "pelangi"] as const;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    // Kunci 7 hari terakhir: { "yyyy-MM": Set(hari) } di timezone Asia/Jakarta
    const want: Record<string, Record<string, boolean>> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(d);
      const y = parts.find((p) => p.type === "year")!.value;
      const m = parts.find((p) => p.type === "month")!.value;
      const day = String(parseInt(parts.find((p) => p.type === "day")!.value, 10));
      const mk = `${y}-${m}`;
      (want[mk] ||= {})[day] = true;
    }

    const { data: members } = await supabaseAdmin().from("members").select("mood_records");
    const counts: Record<string, number> = { cerah: 0, berawan: 0, hujan: 0, badai: 0, pelangi: 0 };
    let total = 0;
    for (const m of members || []) {
      const recs = m.mood_records || {};
      for (const mk of Object.keys(want)) {
        const mrec = recs[mk] || {};
        for (const day of Object.keys(want[mk])) {
          const k = mrec[day];
          if (k && MOOD_KEYS.includes(k)) { counts[k]++; total++; }
        }
      }
    }

    let dominant = "";
    let max = 0;
    for (const k of Object.keys(counts)) if (counts[k] > max) { max = counts[k]; dominant = k; }

    return jsonResponse({ counts, total, dominant });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
