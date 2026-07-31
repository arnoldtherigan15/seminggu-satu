// Publik (nggak butuh login) -- peserta submit pesanan minum/makan mereka
// dari pesanan/index.html. 1 request = 1 peserta pesen 1 menu (mau pesen
// 2 macem tinggal submit 2x).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const data = await req.json();
    const batchId = String(data.batchId || "");
    const menuItemId = String(data.menuItemId || "");
    const participantName = String(data.participantName || "").trim().slice(0, 60);
    const registrationId = String(data.registrationId || "");
    if (!batchId) return errorResponse("Link tidak valid.");
    if (!participantName) return errorResponse("Nama kamu belum diisi.");
    if (!menuItemId) return errorResponse("Menu belum dipilih.");

    const admin = supabaseAdmin();
    const { data: batch } = await admin.from("batches").select("id").eq("id", batchId).maybeSingle();
    if (!batch) return errorResponse("Event tidak ditemukan -- link mungkin udah nggak berlaku.");
    const { data: item } = await admin.from("menu_items").select("id").eq("id", menuItemId).eq("active", true).maybeSingle();
    if (!item) return errorResponse("Menu yang dipilih nggak tersedia lagi, refresh halaman ya.");

    // registrationId opsional (dari link personalisasi) -- kalau ternyata
    // nggak match batch ini, diem-diem disimpen tanpa link-nya aja, jangan
    // sampe gagalin submit-nya cuma gara-gara itu.
    let regId: string | null = null;
    if (registrationId) {
      const { data: reg } = await admin.from("registrations").select("id").eq("id", registrationId).eq("batch_id", batchId).maybeSingle();
      if (reg) regId = reg.id;
    }

    const { error } = await admin.from("event_orders").insert({ batch_id: batchId, participant_name: participantName, menu_item_id: menuItemId, registration_id: regId });
    if (error) return errorResponse("Gagal simpan: " + error.message);
    return jsonResponse({ status: "success", message: "Pesanan tercatat!" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
