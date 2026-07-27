// Port dari memberUpdateProfile_() -- ganti nickname/tanggal lahir/bio/opt-in
// profil publik/foto profil.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("*").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi tidak valid, login lagi ya.");

    // deno-lint-ignore no-explicit-any
    const patch: Record<string, any> = {};

    if (data.nickname !== undefined) {
      const nick = String(data.nickname || "").trim().slice(0, 30);
      if (!nick) return errorResponse("Nama panggilan jangan kosong ya.");
      patch.nickname = nick;
    }
    if (data.birthDate !== undefined) {
      const bd = String(data.birthDate || "").trim();
      if (bd && !/^\d{4}-\d{2}-\d{2}$/.test(bd)) return errorResponse("Format tanggal lahir nggak valid.");
      patch.birth_date = bd || null;
    }
    if (data.bio !== undefined) {
      patch.bio = String(data.bio || "").trim().slice(0, 160);
    }
    if (data.publicOptIn !== undefined) {
      patch.public_opt_in = String(data.publicOptIn) === "1";
    }
    if (data.photoBase64) {
      const photoUrl = await uploadBase64(admin, "profile-photos", data.photoBase64, `profile-${row.wa}`, data.photoMime);
      if (!photoUrl) return errorResponse("Gagal upload foto profil, coba lagi ya.");
      patch.photo_url = photoUrl;
    }

    const { data: updated, error } = await admin.from("members").update(patch).eq("wa", row.wa).select().single();
    if (error || !updated) return errorResponse("Gagal simpan profil, coba lagi ya.", 500);

    return jsonResponse({
      status: "success",
      message: "Profil kesimpen! ✨",
      nickname: updated.nickname || "",
      birthDate: updated.birth_date || "",
      photoUrl: updated.photo_url || "",
      bio: updated.bio || "",
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
