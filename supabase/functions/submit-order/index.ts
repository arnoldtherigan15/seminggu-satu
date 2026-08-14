// Publik (nggak butuh login) -- peserta submit pesanan minum/makan mereka
// dari pesanan/index.html. 1 request = 1 peserta pesen 1 menu (mau pesen
// 2 macem tinggal submit 2x).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { getConfigValue } from "../_shared/config.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

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
    const { data: batch } = await admin.from("batches").select("id, workshop_type, label, event_date").eq("id", batchId).maybeSingle();
    if (!batch) return errorResponse("Event tidak ditemukan -- link mungkin udah nggak berlaku.");
    const { data: item } = await admin.from("menu_items").select("id, name").eq("id", menuItemId).eq("active", true).maybeSingle();
    if (!item) return errorResponse("Menu yang dipilih nggak tersedia lagi, refresh halaman ya.");

    // registrationId opsional (dari link personalisasi) -- kalau ternyata
    // nggak match batch ini, diem-diem disimpen tanpa link-nya aja, jangan
    // sampe gagalin submit-nya cuma gara-gara itu.
    let regId: string | null = null;
    if (registrationId) {
      const { data: reg } = await admin.from("registrations").select("id").eq("id", registrationId).eq("batch_id", batchId).maybeSingle();
      if (reg) regId = reg.id;
    }

    // Link personal (regId ada) -> orangnya udah kenal, resubmit artinya
    // GANTI pesanan (update baris yang udah ada), bukan nambah baris baru.
    // Link generik/grup (regId kosong) tetep insert baru tiap submit --
    // itu emang desainnya buat pesenin banyak orang pake 1 link.
    let isUpdate = false;
    if (regId) {
      const { data: existing } = await admin.from("event_orders").select("id").eq("batch_id", batchId).eq("registration_id", regId).maybeSingle();
      if (existing) {
        const { error } = await admin.from("event_orders").update({ participant_name: participantName, menu_item_id: menuItemId }).eq("id", existing.id);
        if (error) return errorResponse("Gagal update: " + error.message);
        isUpdate = true;
      }
    }
    if (!isUpdate) {
      const { error } = await admin.from("event_orders").insert({ batch_id: batchId, participant_name: participantName, menu_item_id: menuItemId, registration_id: regId });
      if (error) return errorResponse("Gagal simpan: " + error.message);
    }

    // Notif Telegram -- best-effort, jangan gagalin submit kalau ini error
    try {
      let workshopName = batch.workshop_type;
      const cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]");
      const w = cfg.find((x: { id?: string; name?: string }) => x?.id === batch.workshop_type);
      if (w?.name) workshopName = w.name;
      const eventLabel = batch.label || workshopName;
      await sendTelegramText(
        (isUpdate ? "🔄 *Pesanan Diperbarui!*\n\n" : "🥤 *Pesanan Masuk!*\n\n") +
          `🎫 Event: ${eventLabel}\n` +
          `👤 Nama: ${participantName}\n` +
          `🍹 Menu: ${item.name}`,
      );
    } catch (_e) { /* abaikan */ }

    return jsonResponse({ status: "success", message: isUpdate ? "Pesanan kamu udah diperbarui!" : "Pesanan tercatat!" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
