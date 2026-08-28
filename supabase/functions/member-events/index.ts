// Port dari memberRegisteredMap_() (doGet?page=memberEvents) -- workshop mana
// aja yang si member UDAH daftar di batch yang lagi AKTIF.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";
import { getConfigValue } from "../_shared/config.ts";
import { mergeBatchConfig } from "../_shared/batch-merge.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const wa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const key = waKey(wa);
    // Dulu cuma `true` (per workshop_type) -- Warga/main.js jadi cuma bisa
    // nampilin tanggal/link WA Config type-level, BUKAN batch spesifik yang
    // beneran didaftarin. Begitu ada 2+ batch aktif tiap punya jadwal/link WA
    // sendiri (mis. Vol 4 vs Vol 5), tiket countdown & list Event di Warga
    // bisa nunjukin info batch yang SALAH. Sekarang balikin data batch yang
    // udah di-merge (sama pola kayak workshop-batches), bukan boolean doang.
    // deno-lint-ignore no-explicit-any
    const registered: Record<string, any> = {};
    if (!key) return jsonResponse({ registered });

    const admin = supabaseAdmin();
    const { data: activeBatches } = await admin.from("batches").select("*").eq("active", true);
    if (!activeBatches?.length) return jsonResponse({ registered });

    const { data: regs } = await admin
      .from("registrations")
      .select("workshop_type, batch_id")
      .eq("wa", key)
      .in("batch_id", activeBatches.map((b) => b.id));

    let cfg: Record<string, unknown>[] = [];
    try { cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
    const cfgByType = new Map(cfg.map((w) => [String((w as { id?: string }).id || ""), w]));
    const batchById = new Map(activeBatches.map((b) => [b.id, b]));

    // Bisa ada LEBIH DARI 1 batch aktif per tipe sekarang (mis. Vol 6 & Vol 7
    // buka bareng) -- dianggap "udah daftar" kalau dia kedaftar di SALAH SATU
    // dari batch-batch aktif tipe itu (batch terakhir yang ke-iterasi menang
    // kalau kebetulan kedaftar di lebih dari satu, kasus langka).
    for (const r of regs || []) {
      const batch = batchById.get(r.batch_id);
      if (!batch) continue;
      const typeConfig = cfgByType.get(r.workshop_type) || {};
      const merged = mergeBatchConfig(batch, typeConfig);
      registered[r.workshop_type] = {
        batchId: r.batch_id,
        eventDateIso: merged.eventDateIso,
        displayDate: merged.displayDate,
        workshopTime: merged.workshopTime,
        locationName: merged.locationName,
        mapsLink: merged.mapsLink,
        whatsappGroupLink: merged.whatsappGroupLink,
      };
    }

    return jsonResponse({ registered });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
