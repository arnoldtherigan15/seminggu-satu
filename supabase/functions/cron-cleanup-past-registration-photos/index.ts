// Cron harian: foto pendaftaran (bukti bayar + foto karya/charm/print)
// buat batch yang event_date-nya udah lewat (H+1) dihapus dari Storage --
// udah nggak kepake lagi abis eventnya kelar (dipakai admin cuma buat
// nyiapin barang fisik sebelum acara). Reference-nya di DB juga
// dibersihin (bukan cuma file Storage-nya) biar tabel Pendaftar admin
// buat batch lama nggak nampilin ikon gambar rusak, cukup kosong aja.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

function jakartaDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

Deno.serve(async (req) => {
  const admin = supabaseAdmin();
  const today = jakartaDateStr(new Date());
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  // batches.event_date kolom `date` native Postgres -> balik dari Supabase
  // client sebagai string ISO "YYYY-MM-DD", sama format-nya kayak
  // jakartaDateStr() -> bisa dibandingin langsung sebagai string, nggak
  // perlu parse. Kalau kosong, batch itu dilewatin (nggak ada info buat
  // nentuin "udah lewat" apa belum).
  const { data: batches } = await admin.from("batches").select("id, event_date").not("event_date", "is", null);
  const pastBatchIds = (batches || [])
    .filter((b) => typeof b.event_date === "string" && b.event_date < today)
    .map((b) => b.id);

  if (!pastBatchIds.length) {
    return new Response(JSON.stringify({
      status: "success", registrationsCleaned: 0, photosDeleted: 0,
      debug: { totalBatchesWithDate: (batches || []).length, sampleDates: (batches || []).slice(0, 10).map((b) => b.event_date) },
    }), { headers: { "Content-Type": "application/json" } });
  }

  const { data: regs } = await admin
    .from("registrations")
    .select("id, payment_proof_url, extra")
    .in("batch_id", pastBatchIds);

  let registrationsCleaned = 0;
  let photosDeleted = 0;
  const sampleUrls: string[] = [];

  for (const r of regs || []) {
    const extra: Record<string, unknown> = { ...(r.extra || {}) };
    const byBucket: Record<string, string[]> = {};
    const addRef = (u: string) => {
      if (!u) return;
      let bucket = "", path = "";
      const m = u.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (m) { bucket = m[1]; path = decodeURIComponent(m[2]); }
      else if (!/^https?:\/\//.test(u) && u.indexOf("/") > 0) { const i = u.indexOf("/"); bucket = u.slice(0, i); path = u.slice(i + 1); }
      if (!bucket || !path) return;
      if (!byBucket[bucket]) byBucket[bucket] = [];
      byBucket[bucket].push(path);
    };

    let changed = false;
    if (r.payment_proof_url) { addRef(r.payment_proof_url); changed = true; }
    if (extra.charmUrl) { addRef(String(extra.charmUrl)); delete extra.charmUrl; changed = true; }
    if (Array.isArray(extra.photos) && extra.photos.length) {
      (extra.photos as unknown[]).forEach((p) => addRef(String(p || "")));
      extra.photos = [];
      changed = true;
    }
    if (!changed) continue;
    if (dry) {
      if (sampleUrls.length < 8) sampleUrls.push(...Object.values(byBucket).flat().slice(0, 2));
      registrationsCleaned++;
      continue;
    }

    for (const [bucket, paths] of Object.entries(byBucket)) {
      try { await admin.storage.from(bucket).remove(paths); photosDeleted += paths.length; } catch (_e) { /* abaikan, tetep lanjut bersihin DB */ }
    }
    await admin.from("registrations").update({ payment_proof_url: null, extra }).eq("id", r.id);
    registrationsCleaned++;
  }

  return new Response(JSON.stringify({ status: "success", dry, registrationsCleaned, photosDeleted, sampleUrls }), { headers: { "Content-Type": "application/json" } });
});
