// Port dari dailyBirthdayPush() -- dipanggil Supabase Cron tiap jam 9 pagi
// (bukan lewat frontend, jadi nggak butuh CORS/OPTIONS handling).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { sendPush } from "../_shared/push.ts";
import { todaysBirthdays } from "../_shared/members.ts";

Deno.serve(async (_req) => {
  const admin = supabaseAdmin();
  const bd = await todaysBirthdays(admin);
  if (bd.length) {
    const names = bd.map((b) => b.nickname).join(" & ");
    await sendPush("🎂 Ada warga ultah hari ini!", `${names} lagi ulang tahun — kirim ucapan manis di Balai Warga yuk! 🎈`, "https://seminggusatu.com/warga/");
  }
  return new Response(JSON.stringify({ status: "success", birthdays: bd.length }), { headers: { "Content-Type": "application/json" } });
});
