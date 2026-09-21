// Endpoint publik baru -- daftar batch yang LAGI BUKA pendaftaran per tipe
// workshop, dengan data hasil merge (batch override > Config) udah jadi
// siap pakai. Dipanggil semua 7 halaman workshop, no-param, sama kayak
// workshop-counts. Kalau 1 tipe cuma punya 1 batch buka (kasus paling
// umum), halaman auto-pilih itu tanpa nampilin pemilih apa-apa; kalau 2+,
// halaman render pemilih pakai data yang udah dikasih di sini.
//
// Query param opsional `batchId`: kalau dikasih, batch itu DIJAMIN ada di
// response walau nggak lolos filter "open" biasa (mis. kuotanya abis atau
// pendaftarannya baru aja ketutup PAS request ini jalan) -- dipake
// success.html buat mastiin data batch yang BARU AJA didaftarin beneran
// kepampang, bukan malah jatuh ke fallback Config type-level yang basi
// (BUG FATAL yang pernah kejadian: sukses daftar Vol 5, tapi halaman
// sukses nunjukin tanggal/lokasi Vol 4 krn Vol 5 udah nggak lolos filter
// "open" pas endpoint ini di-fetch ulang beberapa detik kemudian).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { getConfigValue } from "../_shared/config.ts";
import { mergeBatchConfig, isBatchOpen, currentPrice, isoToIdDate, MergedBatch } from "../_shared/batch-merge.ts";
// deno-lint-ignore no-explicit-any
type SupabaseAdminClient = any;

async function buildEntry(admin: SupabaseAdminClient, b: Record<string, unknown>, merged: MergedBatch): Promise<Record<string, unknown>> {
  const { count } = await admin.from("registrations").select("id", { count: "exact", head: true }).eq("batch_id", b.id as string).eq("archived", false);
  const usedCount = count ?? 0;
  const remaining = merged.maxQuota > 0 ? Math.max(0, merged.maxQuota - usedCount) : null;
  const entry: Record<string, unknown> = {
    id: merged.id, label: merged.label,
    eventDateIso: merged.eventDateIso, displayDate: merged.displayDate,
    workshopTime: merged.workshopTime, locationName: merged.locationName, mapsLink: merged.mapsLink,
    // Ditambahin biar success.html bisa nunjukin link grup WA yang bener
    // buat batch yang beneran didaftarin (sebelumnya field ini nggak
    // pernah dikirim sama sekali di endpoint ini, cuma dibaca dari Config
    // type-level yang bisa basi begitu batch-nya ganti link sendiri).
    whatsappGroupLink: merged.whatsappGroupLink,
    normalPrice: merged.normalPrice, earlyBirdPrice: merged.earlyBirdPrice,
    earlyBirdDueDate: isoToIdDate(merged.earlyBirdDueDateIso), // DD/MM/YYYY, buat formatDateIndo() di klien
    earlyBirdMaxCount: merged.earlyBirdMaxCount,
    currentPrice: currentPrice(merged, usedCount),
    maxQuota: merged.maxQuota, count: usedCount, remaining, status: "open",
    // Batch tetap ADA di response (masih valid buat direct-link ?vol=/?batch=
    // & tetap dihitung normal) -- ini cuma sinyal buat klien: jangan
    // tampilin di daftar pemilih sesi publik.
    hideFromPicker: merged.hideFromPicker,
    description: merged.description,
  };

  if (b.workshop_type === "upcycle-journal") {
    const { data: regs } = await admin.from("registrations").select("extra").eq("batch_id", b.id as string).eq("archived", false);
    const taken = new Set<string>();
    // deno-lint-ignore no-explicit-any
    for (const r of (regs || []) as any[]) {
      if (r.extra?.coverType) taken.add(String(r.extra.coverType));
      if (r.extra?.flapType) taken.add(String(r.extra.flapType));
    }
    entry.takenBags = [...taken];
  }

  return entry;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = supabaseAdmin();
  const url = new URL(req.url);
  const wantBatchId = url.searchParams.get("batchId") || "";

  let cfg: Record<string, unknown>[] = [];
  try { cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
  const cfgByType = new Map(cfg.map((w) => [String(w.id || ""), w]));

  const { data: activeBatches } = await admin.from("batches").select("*").eq("active", true);

  const result: Record<string, Record<string, unknown>[]> = {};
  let foundWanted = false;
  for (const b of activeBatches || []) {
    const typeConfig = cfgByType.get(b.workshop_type) || {};
    // enabled itu kill-switch tingkat TIPE workshop (bukan per batch) --
    // kalau tipe-nya dimatiin dari Config, jangan tampilin batch apapun.
    if ((typeConfig as { enabled?: boolean }).enabled === false) continue;
    const merged = mergeBatchConfig(b, typeConfig);
    if (b.id === wantBatchId) foundWanted = true;
    if (!isBatchOpen(merged) && b.id !== wantBatchId) continue;

    const entry = await buildEntry(admin, b, merged);
    if (b.id !== wantBatchId) {
      const remaining = entry.remaining as number | null;
      if (remaining !== null && remaining <= 0) continue; // penuh -- jangan ditawarin
    }

    (result[b.workshop_type] ||= []).push(entry);
  }

  // Caller minta batch spesifik (mis. success.html) tapi batch itu nggak
  // ketemu sama sekali di atas -- baik karena udah di-nonaktifin (active=false)
  // ATAU tipe-nya lagi di-disable di Config. Tetep coba ambil manual biar
  // halaman konfirmasi masih dapet data batch yang bener, bukan fallback ke
  // Config type-level yang basi.
  if (wantBatchId && !foundWanted) {
    const { data: specific } = await admin.from("batches").select("*").eq("id", wantBatchId).maybeSingle();
    if (specific) {
      const typeConfig = cfgByType.get(specific.workshop_type) || {};
      const merged = mergeBatchConfig(specific, typeConfig);
      const entry = await buildEntry(admin, specific, merged);
      (result[specific.workshop_type] ||= []).push(entry);
    }
  }

  // PENTING: query batches di atas nggak di-ORDER BY -- tanpa sort eksplisit,
  // urutan array ini cuma kebetulan (biasanya urutan insert DB). Setiap
  // halaman publik yang manggil endpoint ini defaultnya milih entry [0]
  // begitu pengunjung nggak lewat link ?vol= spesifik (mis. 2+ batch buka
  // bareng kayak Vol 4 & Vol 5) -- kalau [0] kebetulan batch LAMA (mis. Vol 4
  // yang harusnya udah nggak dipromosiin lagi), pendaftar bisa ke-daftar ke
  // batch yang salah tanpa sadar (BUG FATAL nyata: pendaftar niat Vol 5,
  // ke-submit ke Vol 4). Urutin di sini SEKALI biar konsisten di semua
  // pemanggil: acara yang tanggalnya PALING DEKAT ke depan menang duluan;
  // yang tanggalnya udah lewat (technically masih "open" krn salah
  // konfigurasi closeDate) didorong ke paling belakang, jangan pernah jadi
  // default.
  const todayIso = new Date().toISOString().slice(0, 10);
  for (const type of Object.keys(result)) {
    result[type].sort((a, b) => {
      const aDate = String((a as { eventDateIso?: string }).eventDateIso || "");
      const bDate = String((b as { eventDateIso?: string }).eventDateIso || "");
      const aFuture = aDate >= todayIso;
      const bFuture = bDate >= todayIso;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aDate.localeCompare(bDate);
    });
  }

  return jsonResponse(result);
});
