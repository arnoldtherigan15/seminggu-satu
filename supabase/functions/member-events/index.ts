// Port dari memberRegisteredMap_() (doGet?page=memberEvents) -- workshop mana
// aja yang si member UDAH daftar di batch yang lagi AKTIF.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const wa = req.method === "GET" ? url.searchParams.get("wa") : (await req.json()).wa;
    const key = waKey(wa);
    const registered: Record<string, boolean> = {};
    if (!key) return jsonResponse({ registered });

    const admin = supabaseAdmin();
    const { data: activeBatches } = await admin.from("batches").select("id, workshop_type").eq("active", true);
    if (!activeBatches?.length) return jsonResponse({ registered });

    const { data: regs } = await admin
      .from("registrations")
      .select("workshop_type, batch_id")
      .eq("wa", key)
      .in("batch_id", activeBatches.map((b) => b.id));

    // Bisa ada LEBIH DARI 1 batch aktif per tipe sekarang (mis. Vol 6 & Vol 7
    // buka bareng) -- dianggap "udah daftar" kalau dia kedaftar di SALAH SATU
    // dari batch-batch aktif tipe itu, bukan cuma yang terakhir di-iterasi.
    const activeByType: Record<string, Set<string>> = {};
    for (const b of activeBatches) (activeByType[b.workshop_type] ||= new Set()).add(b.id);
    for (const r of regs || []) {
      if (activeByType[r.workshop_type]?.has(r.batch_id)) registered[r.workshop_type] = true;
    }

    return jsonResponse({ registered });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
