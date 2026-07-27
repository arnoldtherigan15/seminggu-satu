// Port dari memberCheckin_() -- check-in journal mingguan + foto opsional
// (masuk galeri juga).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const weekKey = String(data.weekKey || "").trim();
    if (!weekKey) return errorResponse("Minggu tidak valid.");
    const note = String(data.note || "").trim();

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("wa, nickname, journal_records").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi tidak valid, login lagi ya.");

    const records = { ...(row.journal_records || {}) };
    const rec: { note: string; ts: string; photo?: string } = { note, ts: new Date().toISOString() };

    if (data.photoBase64) {
      const photo = await uploadBase64(admin, "journal-photos", data.photoBase64, `journal-${weekKey}-${row.wa}`, data.photoMime);
      if (photo) rec.photo = photo;
    }
    if (!rec.photo && records[weekKey]?.photo) rec.photo = records[weekKey].photo; // jangan hilangin foto lama

    records[weekKey] = rec;
    await admin.from("members").update({ journal_records: records }).eq("wa", row.wa);

    return jsonResponse({ status: "success", journalRecords: JSON.stringify(records) });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
