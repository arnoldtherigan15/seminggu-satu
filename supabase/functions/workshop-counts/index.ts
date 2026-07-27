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

  const counts: Record<string, number> = {};
  let upcycleBatchId: string | null = null;

  for (const b of batches || []) {
    const { count } = await admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", b.id);
    counts[b.workshop_type] = count ?? 0;
    if (b.workshop_type === "upcycle-journal") upcycleBatchId = b.id;
  }

  const takenBags: string[] = [];
  if (upcycleBatchId) {
    const { data: regs } = await admin
      .from("registrations")
      .select("extra")
      .eq("batch_id", upcycleBatchId);
    const taken = new Set<string>();
    for (const r of regs || []) {
      const coverType = r.extra?.coverType;
      const flapType = r.extra?.flapType;
      if (coverType) taken.add(String(coverType));
      if (flapType) taken.add(String(flapType));
    }
    takenBags.push(...taken);
  }

  return jsonResponse({ ...counts, takenBags });
});
