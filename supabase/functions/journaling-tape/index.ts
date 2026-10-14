// Endpoint publik -- dipake /unsent-cassette/ (rekam + submit, buka lewat QR
// pas Reka Rekat Vol 6) dan /unsent-cassette/lounge.html (listen-only,
// dibuka Arnold pas sesi "Listening Lounge" di penutup acara). Nggak ada
// auth admin sama sekali -- sama prinsipnya kayak shop-sell, dan memang
// Community Airwaves dirancang bisa didengerin siapa aja tanpa login.
//
// GET  -> balikin semua kaset yang di-share (buat halaman lounge).
// POST -> upload rekaman + simpan metadata (warna + 3 perasaan). Kaset
//         "private" (pilih nggak di-share) NGGAK PERNAH manggil endpoint
//         ini sama sekali -- murni lokal di browser peserta, lihat
//         unsent-cassette/index.html.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { safeKeyPart } from "../_shared/storage.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

const MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
};

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const admin = supabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await admin
        .from("journaling_tapes")
        .select("id, color, feelings, audio_url, created_at")
        .order("created_at", { ascending: true });
      if (error) return errorResponse("Gagal mengambil daftar kaset: " + error.message);
      return jsonResponse({
        status: "success",
        // deno-lint-ignore no-explicit-any
        tapes: (data || []).map((t: any) => ({
          id: t.id, color: t.color, feelings: t.feelings || [],
          audioUrl: t.audio_url, createdAt: t.created_at,
        })),
      });
    }

    const body = await req.json();
    const color = String(body.color || "").trim();
    const feelings = Array.isArray(body.feelings) ? body.feelings.map((f: unknown) => String(f).trim()).filter(Boolean) : [];
    const audioBase64 = String(body.audioBase64 || "");
    const mime = String(body.mime || "audio/webm");

    if (!color) return errorResponse("Warna kaset belum dipilih.");
    if (feelings.length !== 3) return errorResponse("Pilih tepat 3 perasaan.");
    if (!audioBase64) return errorResponse("Rekaman suara belum ada.");

    const ext = MIME_EXT[mime] || "webm";
    const contentType = mime in MIME_EXT ? mime : "audio/webm";
    const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const path = `${safeKeyPart(feelings.join("-"))}-${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await admin.storage.from("journaling-tape-audio").upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (upErr) return errorResponse("Gagal upload rekaman: " + upErr.message);

    const { data: urlData } = admin.storage.from("journaling-tape-audio").getPublicUrl(path);

    const { error: insErr } = await admin.from("journaling_tapes").insert({
      color, feelings, audio_url: urlData.publicUrl,
    });
    if (insErr) return errorResponse("Gagal menyimpan kaset: " + insErr.message);

    return jsonResponse({ status: "success", message: "Kaset masuk ke Koleksi Bersama." });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
