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

// Prefix nama file sering diisi teks bebas manusia (judul challenge, nama
// workshop, dst) yang bisa ada spasi/emoji/tanda baca -- Storage nolak
// ("Invalid key") kalau dipake mentah-mentah di path. Bersihin ke karakter
// aman aja; fallback "file" kalau abis dibersihin nggak nyisa apa-apa
// (mis. judulnya emoji doang).
export function safeKeyPart(s: string): string {
  const cleaned = s
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "") // lepas diakritik (é -> e)
    .replace(/[^\w-]+/g, "-")   // apa aja selain huruf/angka/_/- -> "-" (termasuk emoji, spasi)
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return cleaned || "file";
}

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
  const path = `${safeKeyPart(fileNamePrefix)}-${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage.from(bucket).upload(path, bytes, {
    contentType: type,
    upsert: false,
  });
  if (error) throw new Error(`Gagal upload foto ke bucket "${bucket}": ${error.message}`);

  if (bucket === "payment-proofs") return `${bucket}/${path}`;

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Versi generik uploadBase64() -- nggak dipaksa jadi gambar (jpg/webp),
// dipake buat file arbitrary kayak PDF (mis. MOU yang diupload manual,
// bukan digenerate dari form). Bucket-nya PRIVATE by design (dokumen
// kerjasama bisnis) -- caller yang generate signed URL pas mau ditampilin,
// jadi di sini cukup balikin PATH-nya aja (sama pola kayak payment-proofs).
export async function uploadFileBase64(
  admin: SupabaseClient,
  bucket: string,
  base64: string | undefined | null,
  fileNamePrefix: string,
  mime: string,
  ext: string,
): Promise<string> {
  if (!base64) return "";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `${safeKeyPart(fileNamePrefix)}-${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage.from(bucket).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`Gagal upload file ke bucket "${bucket}": ${error.message}`);
  return path;
}
