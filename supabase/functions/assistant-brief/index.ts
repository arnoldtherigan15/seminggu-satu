// Publik (nggak butuh login) -- dipanggil dari asisten/index.html buat kasih
// "brief" ke asisten freelance yang di-hire buat bantuin hari-H: siapa aja
// yang GAK mau didokumentasi (dari consent pas daftar), request standar
// partner yang kerjasama di batch ini (diisi admin di Prep > Partner &
// Requests), dan daftar peserta buat dicentang di asisten-attendance.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { getConfigValue } from "../_shared/config.ts";

// deno-lint-ignore no-explicit-any
function sanitizePartnerReqGroups(raw: any[]) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((g) =>
    g && typeof g === "object" && typeof g.partnerId === "string" && g.partnerId && Array.isArray(g.items)
  );
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const batchId = url.searchParams.get("batch") || "";
    if (!batchId) return errorResponse("Link tidak valid.");

    const admin = supabaseAdmin();
    const { data: batch } = await admin
      .from("batches")
      .select("id, workshop_type, label, event_date, workshop_date, workshop_time, location_name")
      .eq("id", batchId)
      .maybeSingle();
    if (!batch) return errorResponse("Event tidak ditemukan -- link mungkin udah nggak berlaku.");

    let workshopName = batch.workshop_type;
    try {
      const cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]");
      const w = cfg.find((x: { id?: string; name?: string }) => x?.id === batch.workshop_type);
      if (w?.name) workshopName = w.name;
    } catch (_e) { /* abaikan */ }

    // Peserta yang diarsipkan (daftar tapi nggak jadi ikut) nggak relevan
    // buat asisten hari-H.
    const { data: regs } = await admin
      .from("registrations")
      .select("id, full_name, nickname, consent, attendance")
      .eq("batch_id", batchId)
      .eq("archived", false)
      .order("created_at", { ascending: true });
    const rows = regs || [];

    const noVideoNames = rows.filter((r) => r.consent === false).map((r) => r.nickname || r.full_name || "(tanpa nama)");
    const participants = rows.map((r) => ({ id: r.id, name: r.nickname || r.full_name || "(tanpa nama)", attendance: !!r.attendance }));

    const partnerReqKey = `prep__${batch.workshop_type}__partnerreq__${batchId}`;
    let partnerGroups: { partnerId: string; partnerName: string; items: { text: string; done: boolean }[] }[] = [];
    try {
      const json = await getConfigValue(admin, partnerReqKey);
      partnerGroups = sanitizePartnerReqGroups(json ? JSON.parse(json) : []);
    } catch (_e) { partnerGroups = []; }

    return jsonResponse({
      status: "success",
      workshopName,
      label: batch.label || "",
      displayDate: batch.workshop_date || batch.event_date || "",
      workshopTime: batch.workshop_time || "",
      locationName: batch.location_name || "",
      noVideoNames,
      partnerGroups: partnerGroups.map((g) => ({ partnerName: g.partnerName, items: g.items.map((it) => ({ text: it.text })) })),
      participants,
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
