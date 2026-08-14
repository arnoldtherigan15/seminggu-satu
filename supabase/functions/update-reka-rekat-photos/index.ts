// Publik (nggak butuh login) -- dipanggil dari reka-rekat/update-photo.html.
// Peserta yang UDAH daftar Reka Rekat (biasanya buru-buru isi foto asal dulu
// pas daftar) bisa upload ulang 4 foto journal-nya lewat link personal
// (?rid=<registrationId>) -- ini nge-UPDATE registrasi yang udah ada,
// bukan bikin baris baru.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const data = await req.json();
    const rid = String(data.rid || "");
    if (!rid) return errorResponse("Link tidak valid.");

    const admin = supabaseAdmin();
    const { data: reg } = await admin.from("registrations").select("id, full_name, nickname, workshop_type, extra").eq("id", rid).maybeSingle();
    if (!reg) return errorResponse("Data pendaftaran nggak ketemu -- link mungkin udah nggak berlaku.");
    if (reg.workshop_type !== "reka-rekat") return errorResponse("Link ini bukan buat workshop Reka Rekat.");

    const keys = ["photo1Base64", "photo2Base64", "photo3Base64", "photo4Base64"];
    if (!keys.every((k) => data[k])) return errorResponse("Isi ke-4 fotonya ya, foto lama bakal digantikan semua sama yang baru.");

    const name = reg.nickname || reg.full_name || "Peserta";
    const newPhotos: string[] = [];
    for (const k of keys) {
      const url = await uploadBase64(admin, "registration-photos", data[k], `rekarekat-${name}`);
      if (url) newPhotos.push(url);
    }

    // Bersihin foto lama dari Storage (best-effort) -- yang baru udah GANTI,
    // jangan sampe file lama nyangkut nganggur selamanya di bucket.
    try {
      const oldPhotos = (reg.extra || {}).photos;
      if (Array.isArray(oldPhotos) && oldPhotos.length) {
        const byBucket: Record<string, string[]> = {};
        for (const u of oldPhotos) {
          const m = String(u || "").match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
          if (!m) continue;
          const bucket = m[1], path = decodeURIComponent(m[2]);
          if (!byBucket[bucket]) byBucket[bucket] = [];
          byBucket[bucket].push(path);
        }
        for (const [bucket, paths] of Object.entries(byBucket)) {
          await admin.storage.from(bucket).remove(paths);
        }
      }
    } catch (_e) { /* abaikan, tetep lanjut simpen yang baru */ }

    const newExtra = { ...(reg.extra || {}), photos: newPhotos };
    const { error } = await admin.from("registrations").update({ extra: newExtra }).eq("id", rid);
    if (error) return errorResponse("Gagal menyimpan foto baru: " + error.message);

    return jsonResponse({ status: "success", message: "Foto berhasil diperbarui!", fullName: name });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
