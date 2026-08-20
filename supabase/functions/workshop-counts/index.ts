// Port dari doGet tanpa "page" param (cek kuota/counts.js) -- dipanggil
// homepage + semua halaman registrasi buat nampilin sisa kuota tiap workshop,
// plus warna upcycle bag yang udah "habis" (coverType/flapType terpakai).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = supabaseAdmin();

  const { data: batches } = await admin
    .from("batches")
    .select("id, workshop_type")
    .eq("active", true);

  // Total per TIPE workshop -- sekarang DIJUMLAH dari semua batch yang lagi
  // buka (dulu cuma diasumsikan 1 batch aktif per tipe, jadi baris terakhir
  // nimpa yang sebelumnya kalau kebetulan ada 2). Field ini tetap flat di
  // root object (bukan dibungkus) biar halaman lama yang masih baca
  // `counts[ID]` langsung nggak perlu diubah dulu.
  const counts: Record<string, number> = {};
  // Per BATCH -- field baru, dipakai halaman yang udah bisa milih batch
  // spesifik buat nunjukin sisa slot batch itu doang (bukan total tipe-nya).
  const perBatch: Record<string, number> = {};
  const upcycleBatchIds: string[] = [];

  for (const b of batches || []) {
    const { count } = await admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", b.id);
    counts[b.workshop_type] = (counts[b.workshop_type] || 0) + (count ?? 0);
    perBatch[b.id] = count ?? 0;
    if (b.workshop_type === "upcycle-journal") upcycleBatchIds.push(b.id);
  }

  // Warna bag itu stok fisik PER BATCH (nggak digabung antar batch) --
  // dikumpulin per batch id biar halaman upcycle bisa nunjukin warna yang
  // abis buat batch yang lagi dipilih peserta doang.
  const takenBagsByBatch: Record<string, string[]> = {};
  for (const batchId of upcycleBatchIds) {
    const { data: regs } = await admin
      .from("registrations")
      .select("extra")
      .eq("batch_id", batchId);
    const taken = new Set<string>();
    for (const r of regs || []) {
      const coverType = r.extra?.coverType;
      const flapType = r.extra?.flapType;
      if (coverType) taken.add(String(coverType));
      if (flapType) taken.add(String(flapType));
    }
    takenBagsByBatch[batchId] = [...taken];
  }
  // Back-compat: `takenBags` gabungan semua batch upcycle (halaman lama yang
  // belum pilih batch spesifik masih dapet sesuatu yang masuk akal).
  const takenBags = [...new Set(Object.values(takenBagsByBatch).flat())];

  return jsonResponse({ ...counts, perBatch, takenBags, takenBagsByBatch });
});
