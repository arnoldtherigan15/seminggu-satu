// Port dari weeklyCheckinPush() -- dipanggil Supabase Cron tiap hari Minggu
// jam 9 pagi. Nembak push CUMA ke warga yang belum tag "ciw" (check-in week)
// = minggu berjalan.
import { sendPush } from "../_shared/push.ts";

function currentWeekKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const w = Math.min(4, Math.ceil(day / 7));
  return `${y}-${m}-W${w}`;
}

Deno.serve(async (_req) => {
  const wk = currentWeekKey();
  await sendPush(
    // seminggu-psych: ajakan hangat, bukan nagih streak / hitung mundur
    "Cerita minggu ini",
    "Kalau lagi sempat, simpan memori minggumu di Balai Warga. Nggak sempat juga nggak apa-apa.",
    "https://seminggusatu.com/warga/",
    undefined,
    [
      { field: "tag", key: "ciw", relation: "!=", value: wk },
      { operator: "OR" },
      { field: "tag", key: "ciw", relation: "not_exists" },
    ],
  );
  return new Response(JSON.stringify({ status: "success", weekKey: wk }), { headers: { "Content-Type": "application/json" } });
});
