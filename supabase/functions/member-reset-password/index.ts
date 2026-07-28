// Lupa password: sama persis kayak member-setup (bukti identitas = tau nomor
// WA sendiri, satu-satunya cara verifikasi di app ini karena nggak ada
// email/OTP), bedanya BOLEH nimpa password yang udah ada. Sengaja bikin
// token/salt baru juga -> sesi lama otomatis invalid begitu password diganti.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey, hashPassword, randToken } from "../_shared/auth.ts";
import { isMemberWa, profileResponse } from "../_shared/members.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const waK = waKey(data.wa);
    if (!waK) return errorResponse("Nomor WhatsApp nggak valid.");

    const isMember = await isMemberWa(supabaseAdmin(), waK);
    if (!isMember) return errorResponse("Nomor ini belum terdaftar sebagai warga (belum pernah ikut event).");

    const password = String(data.password || "");
    if (password.length < 4) return errorResponse("Password minimal 4 karakter.");

    const admin = supabaseAdmin();
    const { data: existing } = await admin.from("members").select("*").eq("wa", waK).maybeSingle();
    if (!existing?.pass_hash) {
      return errorResponse("Akun belum pernah dibuat. Yuk buat akun dulu ya.");
    }

    const salt = crypto.randomUUID();
    const hash = await hashPassword(salt, password);
    const token = randToken();
    const now = new Date().toISOString();

    const { data: updated } = await admin
      .from("members")
      .update({ pass_hash: hash, salt, token, last_login: now })
      .eq("wa", waK)
      .select()
      .single();

    if (!updated) return errorResponse("Gagal ganti password, coba lagi ya.", 500);
    return jsonResponse(await profileResponse(admin, updated));
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
