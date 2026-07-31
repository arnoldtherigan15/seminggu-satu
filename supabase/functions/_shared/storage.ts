import { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Port dari uploadFile() -- base64 dari frontend -> Supabase Storage,
// ganti Google Drive. Bucket public (registration-photos, quest-photos,
// event-photos, profile-photos, journal-photos) -> balikin URL publik.
// Bucket private (payment-proofs) -> balikin PATH-nya aja (bukan URL publik,
// biar admin yang generate signed URL pas mau liat -- bukti bayar sensitif).
//
// SENGAJA throw (bukan nelen error terus balikin "") kalau upload-nya gagal --
// dulu ke-swallow diem-diem, akibatnya caller (mis. saveChallenge) ngelanjut
// nyimpen data TANPA gambar tapi tetep lapor "berhasil" ke admin (bug nyata:
// beberapa challenge kelihatan kesimpen padahal foto-nya nggak pernah nyampe
// ke Storage). Semua Edge Function di sini udah bungkus logic-nya pake
// try/catch di level atas yang balikin errorResponse(), jadi throw di sini
// otomatis muncul jadi pesan error yang jujur ke caller manapun.
export async function uploadBase64(
  admin: SupabaseClient,
  bucket: string,
  base64: string | undefined | null,
  fileNamePrefix: string,
  mime?: string,
): Promise<string> {
  if (!base64) return "";
  const type = mime === "image/webp" ? "image/webp" : "image/jpeg";
  const ext = type === "image/webp" ? "webp" : "jpg";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `${fileNamePrefix}-${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage.from(bucket).upload(path, bytes, {
    contentType: type,
    upsert: false,
  });
  if (error) throw new Error(`Gagal upload foto ke bucket "${bucket}": ${error.message}`);

  if (bucket === "payment-proofs") return `${bucket}/${path}`;

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
