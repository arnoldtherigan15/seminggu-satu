// Publik (nggak butuh login) -- dipanggil dari pesanan/index.html buat
// nampilin nama event + daftar menu aktif yang bisa dipesen peserta.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { getConfigValue } from "../_shared/config.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const url = new URL(req.url);
    const batchId = url.searchParams.get("batchId") || "";
    const rid = url.searchParams.get("rid") || "";
    if (!batchId) return errorResponse("Link tidak valid.");

    const admin = supabaseAdmin();
    const { data: batch } = await admin.from("batches").select("id, workshop_type, label, event_date").eq("id", batchId).maybeSingle();
    if (!batch) return errorResponse("Event tidak ditemukan -- link mungkin udah nggak berlaku.");

    let workshopName = batch.workshop_type;
    try {
      const cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]");
      const w = cfg.find((x: { id?: string; name?: string }) => x?.id === batch.workshop_type);
      if (w?.name) workshopName = w.name;
    } catch (_e) { /* abaikan */ }

    const { data: rows } = await admin.from("menu_items").select("id, name, description, image_url").eq("active", true).order("created_at", { ascending: true });
    const items = (rows || []).map((r) => ({ id: r.id, name: r.name, description: r.description || "", imageUrl: r.image_url || "" }));

    // Link personalisasi (?rid=<registrationId>) -> nama udah diketahui,
    // peserta di pesanan/index.html nggak perlu ngetik nama sendiri lagi.
    // Kalau rid nggak valid/nggak match batch ini, diem-diem fallback ke
    // form manual (bukan error) -- link generik lama tetep harus jalan.
    let participantName = "";
    let existingMenuItemId = "";
    if (rid) {
      const { data: reg } = await admin.from("registrations").select("nickname, full_name").eq("id", rid).eq("batch_id", batchId).maybeSingle();
      if (reg) participantName = reg.nickname || reg.full_name || "";
      // Pesanan yang udah ada buat orang ini (kalau ada) -- ditampilin di
      // form biar peserta tau pesenan lamanya sebelum milih ulang (resubmit
      // dari link ini bakal GANTI pesanan ini, bukan nambah baris baru).
      const { data: order } = await admin.from("event_orders").select("menu_item_id").eq("batch_id", batchId).eq("registration_id", rid).maybeSingle();
      if (order) existingMenuItemId = order.menu_item_id;
    }

    return jsonResponse({
      status: "success", workshopName, label: batch.label || "", eventDate: batch.event_date || "", items, participantName, existingMenuItemId,
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
