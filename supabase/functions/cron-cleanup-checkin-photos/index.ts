// Cron bulanan: foto check-in journal yang udah lewat bulan dihapus dari
// Storage. Foto ini emang cuma ditampilin buat minggu BERJALAN (lihat
// renderJournalTrackerHtml() & weeklyPhotosThisWeek() di warga/main.js) --
// begitu minggu ganti, fotonya nggak pernah muncul lagi di mana pun (app
// maupun admin). Note/tanggal/streak TETEP disimpen -- cuma field `photo`
// yang dicopot, biar histori & streak warga tetep akurat, Storage-nya doang
// yang dibersihin.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

function jakartaMonthPrefix(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx < 0 ? null : url.slice(idx + marker.length);
}

Deno.serve(async (req) => {
  const admin = supabaseAdmin();
  const currentMonth = jakartaMonthPrefix(new Date());
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const { data: members } = await admin.from("members").select("wa, journal_records").not("journal_records", "is", null);

  let membersCleaned = 0;
  let photosDeleted = 0;
  const sampleUrls: string[] = [];
  for (const m of members || []) {
    const records: Record<string, { note?: string; ts?: string; photo?: string }> = m.journal_records || {};
    const paths: string[] = [];
    let changed = false;

    for (const key of Object.keys(records)) {
      const rec = records[key];
      if (dry && rec && rec.photo && sampleUrls.length < 5) sampleUrls.push(rec.photo);
      if (!rec || !rec.photo || key.slice(0, 7) === currentMonth) continue;
      const path = storagePathFromPublicUrl(rec.photo, "journal-photos");
      if (path) paths.push(path);
      if (!dry) delete rec.photo;
      changed = true;
    }

    if (!changed || dry) continue;
    if (paths.length) {
      try { await admin.storage.from("journal-photos").remove(paths); photosDeleted += paths.length; } catch (_e) { /* abaikan, lanjut ke member berikutnya */ }
    }
    await admin.from("members").update({ journal_records: records }).eq("wa", m.wa);
    membersCleaned++;
  }

  return new Response(JSON.stringify({ status: "success", dry, membersCleaned, photosDeleted, sampleUrls }), { headers: { "Content-Type": "application/json" } });
});
