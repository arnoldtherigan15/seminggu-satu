// Ganti nama/sampul buku jurnal bulan ini TANPA perlu nulis entri baru --
// dipisah dari member-book-add karena nyimpen kustomisasi nggak boleh
// keiket ke jatah "1 entri/hari" (kalau nggak, ganti nama nggak bisa
// disimpen begitu kuota hari itu udah kepake -- bug nyata yang pernah
// kejadian di Gratitude Jar, jangan diulang di sini).
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

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("wa, writing_records").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi tidak valid, login lagi ya.");

    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit",
    }).formatToParts(now);
    const monthKey = `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;

    const recs = { ...(row.writing_records || {}) };
    const book = recs[monthKey] || { name: "", cover: "", entries: [] };

    const name = String(data.name ?? book.name ?? "").trim().slice(0, 30);
    const coverIn = String(data.cover ?? "");
    const cover = VALID_COVER.has(coverIn) ? coverIn : (book.cover || "");

    recs[monthKey] = { ...book, name, cover };

    await admin.from("members").update({ writing_records: recs }).eq("wa", row.wa);

    return jsonResponse({ status: "success", writingRecords: JSON.stringify(recs) });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
