// Endpoint publik baru -- daftar batch yang LAGI BUKA pendaftaran per tipe
// workshop, dengan data hasil merge (batch override > Config) udah jadi
// siap pakai. Dipanggil semua 7 halaman workshop, no-param, sama kayak
// workshop-counts. Kalau 1 tipe cuma punya 1 batch buka (kasus paling
// umum), halaman auto-pilih itu tanpa nampilin pemilih apa-apa; kalau 2+,
// halaman render pemilih pakai data yang udah dikasih di sini.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { getConfigValue } from "../_shared/config.ts";
import { mergeBatchConfig, isBatchOpen, currentPrice, isoToIdDate } from "../_shared/batch-merge.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = supabaseAdmin();

  let cfg: Record<string, unknown>[] = [];
  try { cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
  const cfgByType = new Map(cfg.map((w) => [String(w.id || ""), w]));

  const { data: activeBatches } = await admin.from("batches").select("*").eq("active", true);

  const result: Record<string, Record<string, unknown>[]> = {};
  for (const b of activeBatches || []) {
    const typeConfig = cfgByType.get(b.workshop_type) || {};
    // enabled itu kill-switch tingkat TIPE workshop (bukan per batch) --
    // kalau tipe-nya dimatiin dari Config, jangan tampilin batch apapun.
    if ((typeConfig as { enabled?: boolean }).enabled === false) continue;
    const merged = mergeBatchConfig(b, typeConfig);
    if (!isBatchOpen(merged)) continue;

    const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", b.id).eq("archived", false);
    const usedCount = count ?? 0;
    const remaining = merged.maxQuota > 0 ? Math.max(0, merged.maxQuota - usedCount) : null;
    if (remaining !== null && remaining <= 0) continue; // penuh -- jangan ditawarin

    const entry: Record<string, unknown> = {
      id: merged.id, label: merged.label,
      eventDateIso: merged.eventDateIso, displayDate: merged.displayDate,
      workshopTime: merged.workshopTime, locationName: merged.locationName, mapsLink: merged.mapsLink,
      normalPrice: merged.normalPrice, earlyBirdPrice: merged.earlyBirdPrice,
      earlyBirdDueDate: isoToIdDate(merged.earlyBirdDueDateIso), // DD/MM/YYYY, buat formatDateIndo() di klien
      earlyBirdMaxCount: merged.earlyBirdMaxCount,
      currentPrice: currentPrice(merged, usedCount),
      maxQuota: merged.maxQuota, count: usedCount, remaining, status: "open",
    };

    if (b.workshop_type === "upcycle-journal") {
      const { data: regs } = await admin.from("registrations").select("extra").eq("batch_id", b.id).eq("archived", false);
      const taken = new Set<string>();
      for (const r of regs || []) {
        if (r.extra?.coverType) taken.add(String(r.extra.coverType));
        if (r.extra?.flapType) taken.add(String(r.extra.flapType));
      }
      entry.takenBags = [...taken];
    }

    (result[b.workshop_type] ||= []).push(entry);
  }

  return jsonResponse(result);
});
