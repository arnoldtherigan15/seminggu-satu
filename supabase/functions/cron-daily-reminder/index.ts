// Port dari sendDailyReminder() -- dipanggil Supabase Cron tiap jam 8 pagi.
// Reminder ke Telegram admin buat event yang HARI INI/BESOK, plus jumlah
// pendaftar di batch aktifnya. Sekarang loop per BATCH aktif (bukan per tipe
// workshop) -- batch bisa punya tanggal/lokasi sendiri beda dari Config, dan
// bisa ada lebih dari 1 batch aktif per tipe (mis. Vol 6 & Vol 7 buka bareng),
// jadi tiap batch harus dicek independen pakai data hasil merge-nya sendiri.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { getConfigValue } from "../_shared/config.ts";
import { sendTelegramText } from "../_shared/telegram.ts";
import { todaysBirthdays } from "../_shared/members.ts";
import { mergeBatchConfig } from "../_shared/batch-merge.ts";

function jakartaIso(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const dd = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${dd}`;
}

Deno.serve(async (_req) => {
  const admin = supabaseAdmin();
  let cfg: Record<string, unknown>[] = [];
  try { cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
  if (!cfg.length) return new Response(JSON.stringify({ status: "success", sent: false, reason: "no config" }));
  const cfgByType = new Map(cfg.map((w) => [String(w.id || ""), w]));

  const now = new Date();
  const tmr = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayIso = jakartaIso(now);
  const tomorrowIso = jakartaIso(tmr);

  const { data: activeBatches } = await admin.from("batches").select("*").eq("active", true);

  const blocks: string[] = [];
  for (const batch of activeBatches || []) {
    const typeConfig = cfgByType.get(batch.workshop_type) || {};
    const merged = mergeBatchConfig(batch, typeConfig);
    if (!merged.eventDateIso) continue;
    let when: string | null = null;
    if (merged.eventDateIso === tomorrowIso) when = "BESOK";
    else if (merged.eventDateIso === todayIso) when = "HARI INI";
    if (!when) continue;

    const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", batch.id);
    const workshopName = String(typeConfig.name || batch.workshop_type);
    const batchLabel = merged.label ? ` (${merged.label})` : "";

    blocks.push(
      `🎨 *${workshopName}${batchLabel}* — _${when}_\n` +
      `📅 ${merged.displayDate || merged.eventDateIso}${merged.workshopTime ? ` · ${merged.workshopTime}` : ""}\n` +
      `📍 ${merged.locationName || "-"}\n` +
      `👥 *${count ?? 0}*${merged.maxQuota ? `/${merged.maxQuota}` : ""} peserta terdaftar`,
    );
  }

  // Ultah dikirim sebagai PESAN TERPISAH (bukan disatuin ke reminder event)
  // -- biar gampang dibedain sekilas di chat Telegram yang isinya campur
  // banyak jenis notif, tiap jenis punya "bentuk" sendiri yang konsisten.
  try {
    const bdays = await todaysBirthdays(admin);
    if (bdays.length) {
      const names = bdays.map((b) => `• ${b.nickname}`).join("\n");
      await sendTelegramText(`🎂 *Ultah Hari Ini!*\n\n${names}\n\n_Jangan lupa kasih ucapan ya_ 🥳`);
    }
  } catch (_e) { /* jangan ganggu reminder event kalau ini gagal */ }

  if (!blocks.length) return new Response(JSON.stringify({ status: "success", sent: false, reason: "no events today/tomorrow" }));

  await sendTelegramText(`⏰ *Reminder Event*\n\n${blocks.join("\n\n")}\n\n_Cek tab Prep buat checklist persiapan & barang bawaan ya!_ 💪`);
  return new Response(JSON.stringify({ status: "success", sent: true, events: blocks.length }), { headers: { "Content-Type": "application/json" } });
});
