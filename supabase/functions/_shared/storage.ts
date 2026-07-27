import { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Port dari uploadFile() -- base64 dari frontend -> Supabase Storage,
// ganti Google Drive. Bucket public (registration-photos, quest-photos,
// event-photos, profile-photos, journal-photos) -> balikin URL publik.
// Bucket private (payment-proofs) -> balikin PATH-nya aja (bukan URL publik,
// biar admin yang generate signed URL pas mau liat -- bukti bayar sensitif).
export async function uploadBase64(
  admin: SupabaseClient,
  bucket: string,
  base64: string | undefined | null,
  fileNamePrefix: string,
  mime?: string,
): Promise<string> {
  if (!base64) return "";
  try {
    const type = mime === "image/webp" ? "image/webp" : "image/jpeg";
    const ext = type === "image/webp" ? "webp" : "jpg";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${fileNamePrefix}-${crypto.randomUUID()}.${ext}`;

    const { error } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: type,
      upsert: false,
    });
    if (error) return "";

    if (bucket === "payment-proofs") return `${bucket}/${path}`;

    const { data } = admin.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (_e) {
    return "";
  }
}
