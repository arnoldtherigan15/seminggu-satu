// Gratitude Jar (toples syukur/impian): 1 entri per hari per warga, dikelompokkan per bulan
// (pola sama kayak member-set-mood -- JSONB per-member, key "YYYY-MM").
// Nama & warna pita disimpen per bulan juga, jadi tiap "toples" (bulan) bisa
// beda gaya, dan yang lama tetep bisa dibuka-buka lagi (nggak di-reset).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    const text = String(data.text || "").trim().slice(0, 60);
    if (!text) return errorResponse("Kata/kalimatnya belum diisi.");

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("wa, jar_records").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi tidak valid, login lagi ya.");

    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
    const monthKey = `${y}-${m}`;

    const recs = { ...(row.jar_records || {}) };
    const jar = recs[monthKey] || { name: "Gratitude Jar", ribbon: "#ffe600", items: [] };
    const items: { text: string; day: number; ts: string }[] = Array.isArray(jar.items) ? jar.items : [];

    if (items.some((it) => it.day === d)) {
      return errorResponse("Udah masukin 1 kali hari ini — balik lagi besok ya 💙");
    }

    const jarName = String(data.jarName || jar.name || "Gratitude Jar").trim().slice(0, 24) || "Gratitude Jar";
    const ribbonIn = String(data.ribbon || "");
    const ribbon = HEX_RE.test(ribbonIn) ? ribbonIn : (jar.ribbon || "#ffe600");

    recs[monthKey] = { name: jarName, ribbon, items: [...items, { text, day: d, ts: now.toISOString() }] };

    await admin.from("members").update({ jar_records: recs }).eq("wa", row.wa);

    return jsonResponse({ status: "success", jarRecords: JSON.stringify(recs) });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
