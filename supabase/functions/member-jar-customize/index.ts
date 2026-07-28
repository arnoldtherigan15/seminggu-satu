// Ganti nama/warna pita jar TANPA perlu masukin kata baru -- dipisah dari
// member-jar-add karena nyimpen kustomisasi nggak boleh keiket ke jatah
// "1 kata/hari" (kalau nggak, ganti nama nggak bisa disimpen begitu kuota
// hari itu udah kepake, kejadian nyata pas ditest).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("wa, jar_records").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi tidak valid, login lagi ya.");

    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit",
    }).formatToParts(now);
    const monthKey = `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;

    const recs = { ...(row.jar_records || {}) };
    const jar = recs[monthKey] || { name: "Gratitude Jar", ribbon: "#ffe600", items: [] };

    const jarName = String(data.jarName || jar.name || "Gratitude Jar").trim().slice(0, 24) || "Gratitude Jar";
    const ribbonIn = String(data.ribbon || "");
    const ribbon = HEX_RE.test(ribbonIn) ? ribbonIn : (jar.ribbon || "#ffe600");

    recs[monthKey] = { ...jar, name: jarName, ribbon };

    await admin.from("members").update({ jar_records: recs }).eq("wa", row.wa);

    return jsonResponse({ status: "success", jarRecords: JSON.stringify(recs) });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
