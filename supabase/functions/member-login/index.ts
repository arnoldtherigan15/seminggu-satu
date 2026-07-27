// Port dari memberLogin_() -- login pakai WA + password, balikin token sesi.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey, hashPassword, randToken } from "../_shared/auth.ts";
import { profileResponse } from "../_shared/members.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const waK = waKey(data.wa);
    if (!waK) return errorResponse("Nomor WhatsApp nggak valid.");

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("*").eq("wa", waK).maybeSingle();
    if (!row) return errorResponse("Belum punya akun. Bikin akun dulu ya.");
    if (!row.pass_hash) return errorResponse("Belum set password. Bikin akun dulu ya.");

    const attemptHash = await hashPassword(row.salt, String(data.password || ""));
    if (attemptHash !== row.pass_hash) return errorResponse("Password salah.");

    let token = row.token;
    if (!token) token = randToken();

    const { data: updated } = await admin
      .from("members")
      .update({ token, last_login: new Date().toISOString() })
      .eq("wa", waK)
      .select()
      .single();

    return jsonResponse(await profileResponse(admin, updated || { ...row, token }));
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
