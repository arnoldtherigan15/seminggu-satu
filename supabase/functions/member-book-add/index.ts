// Jurnal Bulanan: 1 entri tulisan bebas per hari per warga, dikelompokkan
// per bulan (pola sama kayak member-jar-add -- JSONB per-member, key
// "YYYY-MM"). Nama & sampul disimpen per bulan juga, jadi tiap "buku"
// (bulan) bisa beda gaya, dan yang lama tetep bisa dibuka-buka lagi
// (nggak di-reset, lihat skill seminggu-psych soal nggak nge-punish).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

const VALID_COVER = new Set([
  "",
  "custom",
  ...Array.from({ length: 19 }, (_, i) => `pattern-${i + 1}`),
]);

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const text = String(data.text || "").trim().slice(0, 240);
    if (!text) return errorResponse("Tulisannya belum diisi.");

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("wa, writing_records").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi tidak valid, login lagi ya.");

    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
    const monthKey = `${y}-${m}`;

    const recs = { ...(row.writing_records || {}) };
    const book = recs[monthKey] || { name: "", cover: "", entries: [] };
    const entries: { text: string; day: number; ts: string }[] = Array.isArray(book.entries) ? book.entries : [];

    if (entries.some((e) => e.day === d)) {
      return errorResponse("Udah nulis 1 kali hari ini — balik lagi besok ya 💙");
    }

    const cover = VALID_COVER.has(String(data.cover || "")) ? String(data.cover || book.cover || "") : (book.cover || "");
    recs[monthKey] = { name: book.name || "", cover, entries: [...entries, { text, day: d, ts: now.toISOString() }] };

    await admin.from("members").update({ writing_records: recs }).eq("wa", row.wa);

    return jsonResponse({ status: "success", writingRecords: JSON.stringify(recs) });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
