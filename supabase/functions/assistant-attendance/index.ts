// Publik (nggak butuh login) -- asisten centang kehadiran peserta dari
// asisten/index.html. Nulis ke kolom yang SAMA (registrations.attendance)
// yang dipakai checklist Absen di admin, jadi otomatis nyambung dua arah.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const data = await req.json();
    const batchId = String(data.batchId || "");
    const registrationId = String(data.registrationId || "");
    if (!batchId || !registrationId) return errorResponse("Link tidak valid.");

    const admin = supabaseAdmin();
    // Pastiin registrationId beneran punya batch ini -- jangan sampe link 1
    // batch bisa dipakai ngutak-ngatik absen peserta batch lain.
    const { data: reg } = await admin.from("registrations").select("id").eq("id", registrationId).eq("batch_id", batchId).maybeSingle();
    if (!reg) return errorResponse("Peserta tidak ditemukan di event ini.");

    const { error } = await admin.from("registrations").update({ attendance: !!data.hadir }).eq("id", registrationId);
    if (error) return errorResponse("Gagal simpan kehadiran.");
    return jsonResponse({ status: "success" });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
