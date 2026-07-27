// Port dari memberSession_() -- validasi token yang tersimpan di localStorage
// browser, buat auto-login.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { profileResponse } from "../_shared/members.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const token = String(data.token || "");
    if (!token) return errorResponse("Sesi tidak valid.");

    const admin = supabaseAdmin();
    const { data: row } = await admin.from("members").select("*").eq("token", token).maybeSingle();
    if (!row) return errorResponse("Sesi kadaluarsa. Login lagi ya.");

    return jsonResponse(await profileResponse(admin, row));
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
