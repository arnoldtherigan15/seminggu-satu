// Port dari memberSetup_() -- pertama kali warga bikin akun: verifikasi
// member (pernah ikut event berbayar) + set password + tanggal lahir.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { waKey, hashPassword, randToken } from "../_shared/auth.ts";
import { isMemberWa, profileResponse } from "../_shared/members.ts";
import { sendTelegramText } from "../_shared/telegram.ts";

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
    const birthDate = String(data.birthDate || "").trim();

    const admin = supabaseAdmin();
    const { data: existing } = await admin.from("members").select("*").eq("wa", waK).maybeSingle();

    if (existing?.pass_hash) {
      return errorResponse("Akun udah ada. Silakan login pakai password kamu ya.");
    }

    const salt = crypto.randomUUID();
    const hash = await hashPassword(salt, password);
    const token = randToken();
    const now = new Date().toISOString();
    const nickname = existing?.nickname || "Sahabat";

    let row;
    if (existing) {
      const { data: updated } = await admin
        .from("members")
        .update({ nickname, birth_date: birthDate || null, pass_hash: hash, salt, token, last_login: now })
        .eq("wa", waK)
        .select()
        .single();
      row = updated;
    } else {
      const { data: inserted } = await admin
        .from("members")
        .insert({
          wa: waK, nickname, birth_date: birthDate || null, pass_hash: hash, salt, token,
          created_at: now, last_login: now, journal_records: {},
        })
        .select()
        .single();
      row = inserted;
    }

    if (!row) return errorResponse("Gagal bikin akun, coba lagi ya.", 500);

    // Notif Telegram -- best-effort, jangan gagalin aktivasi kalau ini error
    try {
      await sendTelegramText(
        "🎉 *Warga Baru Aktivasi Akun!*\n\n" +
          `👤 Nama: ${nickname}\n` +
          `📱 WA: ${waK}`,
      );
    } catch (_e) { /* abaikan */ }

    return jsonResponse(await profileResponse(admin, row));
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
