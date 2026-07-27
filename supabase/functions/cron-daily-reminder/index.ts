// Port dari sendDailyReminder() -- dipanggil Supabase Cron tiap jam 8 pagi.
// Reminder ke Telegram admin buat event yang HARI INI/BESOK, plus jumlah
// pendaftar di batch aktifnya.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { getConfigValue } from "../_shared/config.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

function parseDMY(s: string): { d: number; m: number; y: number } | null {
  const p = String(s || "").split("/");
  if (p.length !== 3) return null;
  const d = parseInt(p[0], 10), m = parseInt(p[1], 10), y = parseInt(p[2], 10);
  if (!d || !m || !y) return null;
  return { d, m, y };
}
const sameDMY = (a: { d: number; m: number; y: number } | null, b: { d: number; m: number; y: number }) =>
  !!a && a.d === b.d && a.m === b.m && a.y === b.y;

function jakartaDMY(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  return {
    d: parseInt(parts.find((p) => p.type === "day")!.value, 10),
    m: parseInt(parts.find((p) => p.type === "month")!.value, 10),
    y: parseInt(parts.find((p) => p.type === "year")!.value, 10),
  };
}

Deno.serve(async (_req) => {
  const admin = supabaseAdmin();
  let cfg: {
    id: string; name?: string; eventDate?: string; workshopDate?: string; workshopTime?: string;
    locationName?: string; maxQuota?: number;
  }[] = [];
  try { cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
  if (!cfg.length) return new Response(JSON.stringify({ status: "success", sent: false, reason: "no config" }));

  const now = new Date();
  const tmr = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const today = jakartaDMY(now);
  const tomorrow = jakartaDMY(tmr);

  const blocks: string[] = [];
  for (const w of cfg) {
    const ev = parseDMY(w.eventDate || "");
    if (!ev) continue;
    let when: string | null = null;
    if (sameDMY(ev, tomorrow)) when = "BESOK";
    else if (sameDMY(ev, today)) when = "HARI INI";
    if (!when) continue;

    const { data: batch } = await admin.from("batches").select("id").eq("workshop_type", w.id).eq("active", true).maybeSingle();
    let count = 0;
    if (batch) {
      const { count: c } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", batch.id);
      count = c ?? 0;
    }

    blocks.push(
      `🎨 *${w.name || w.id}* — _${when}_\n` +
      `📅 ${w.workshopDate || w.eventDate}${w.workshopTime ? ` · ${w.workshopTime}` : ""}\n` +
      `📍 ${w.locationName || "-"}\n` +
      `👥 *${count}*${w.maxQuota ? `/${w.maxQuota}` : ""} peserta terdaftar`,
    );
  }

  if (!blocks.length) return new Response(JSON.stringify({ status: "success", sent: false, reason: "no events today/tomorrow" }));

  await sendTelegramText(`⏰ *Reminder Event*\n\n${blocks.join("\n\n")}\n\n_Cek tab Prep buat checklist persiapan & barang bawaan ya!_ 💪`);
  return new Response(JSON.stringify({ status: "success", sent: true, events: blocks.length }), { headers: { "Content-Type": "application/json" } });
});
