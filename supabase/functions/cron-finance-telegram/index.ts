// Dipanggil pg_cron tiap hari 19.00 WIB (lihat migrasi finance_telegram_cron).
// Kirim ke chat Telegram yang udah di-link di Keuangan pribadi:
//  1. tagihan rutin yang jatuh tempo BESOK & belum lunas (+ tombol "Lunas & catat")
//  2. Minggu malam: rekap singkat minggu ini (Senin-Minggu)
// Nada pesan sengaja netral & hangat -- info, bukan teguran (seminggu-psych).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { getSettings, tg, escHtml } from "../_shared/tg-finance.ts";
import { rp, todayWib } from "../_shared/quick-tx.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// periode checklist tagihan (sama kayak billPeriodKey di admin): bulan mulai periode berdasar reset_day
function billPeriodKey(resetDay: number, iso: string): string {
  let y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1;
  if (Number(iso.slice(8, 10)) < resetDay) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  const admin = supabaseAdmin();
  const s = await getSettings(admin, ["cron_key", "tg_chat_id"]);
  if (!s.cron_key || req.headers.get("x-cron-key") !== s.cron_key) return json({ status: "error", message: "forbidden" }, 403);
  if (!s.tg_chat_id) return json({ status: "success", sent: 0, reason: "telegram belum di-link" });
  const today = todayWib(), tomorrow = addDays(today, 1);
  const sent: string[] = [];

  // 1. tagihan jatuh tempo besok
  const { data: bills } = await admin.from("personal_bills").select("id, name, amount, reset_day").eq("archived", false);
  const due = (bills || []).filter((b: { reset_day: number }) => Number(b.reset_day) === Number(tomorrow.slice(8, 10)));
  if (due.length) {
    const { data: pays } = await admin.from("personal_bill_payments").select("bill_id, period_key").in("bill_id", due.map((b: { id: string }) => b.id));
    const unpaid = due.filter((b: { id: string; reset_day: number }) => !(pays || []).some((p: { bill_id: string; period_key: string }) => p.bill_id === b.id && p.period_key === billPeriodKey(b.reset_day, tomorrow)));
    if (unpaid.length) {
      const total = unpaid.reduce((a: number, b: { amount: number }) => a + Number(b.amount), 0);
      const lines = unpaid.map((b: { name: string; amount: number }) => `• ${escHtml(b.name)} · ${rp(b.amount)}`).join("\n");
      await tg("sendMessage", {
        chat_id: s.tg_chat_id, parse_mode: "HTML",
        text: `<b>Besok jatuh tempo</b>\n${lines}${unpaid.length > 1 ? `\nTotal ${rp(total)}` : ""}\n\nUdah dibayar? Tekan tombolnya, sekalian kecatat sebagai pengeluaran.`,
        reply_markup: { inline_keyboard: unpaid.map((b: { id: string; name: string }) => [{ text: `Lunas & catat: ${b.name}`.slice(0, 60), callback_data: "bp:" + b.id }]) },
      });
      sent.push("bills");
    }
  }

  // 2. Minggu malam: rekap minggu ini
  if (new Date(today + "T00:00:00Z").getUTCDay() === 0) {
    await weeklyRecap(admin, s.tg_chat_id, today);
    sent.push("weekly");
  }
  return json({ status: "success", sent });
});

async function weeklyRecap(admin: Admin, chatId: string, sunday: string) {
  const from = addDays(sunday, -6), prevFrom = addDays(sunday, -13), prevTo = addDays(sunday, -7);
  const [cur, prev, cats] = await Promise.all([
    admin.from("personal_transactions").select("type, amount, category_id, note").gte("date", from).lte("date", sunday),
    admin.from("personal_transactions").select("type, amount").gte("date", prevFrom).lte("date", prevTo),
    admin.from("personal_categories").select("id, name"),
  ]);
  const list = cur.data || [];
  const sum = (l: { type: string; amount: number }[], t: string) => l.filter((x) => x.type === t).reduce((a, x) => a + Number(x.amount), 0);
  if (!list.length) {
    return tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: "<b>Rekap minggu ini</b>\nMinggu ini belum ada catatan. Kalau ada yang kelewat, ketik aja di sini kapan pun -- nggak harus lengkap." });
  }
  const out = sum(list, "expense"), inc = sum(list, "income"), prevOut = sum(prev.data || [], "expense");
  const byCat = new Map<string, number>();
  for (const t of list) if (t.type === "expense") byCat.set(t.category_id || "-", (byCat.get(t.category_id || "-") || 0) + Number(t.amount));
  const name = (id: string) => ((cats.data || []).find((c: { id: string }) => c.id === id) || { name: "Tanpa kategori" }).name;
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => `• ${escHtml(name(id))}: ${rp(v)}`).join("\n");
  const cmp = prevOut ? (out > prevOut ? `${rp(out - prevOut)} lebih banyak dari minggu lalu` : out < prevOut ? `${rp(prevOut - out)} lebih sedikit dari minggu lalu` : "sama kayak minggu lalu") : "";
  const text = `<b>Rekap minggu ini</b> (${list.length} catatan)\nKeluar ${rp(out)}${inc ? ` · Masuk ${rp(inc)}` : ""}${cmp ? `\n<i>${cmp}</i>` : ""}${top ? `\n\n<b>Paling banyak ke</b>\n${top}` : ""}\n\nMakasih udah nyatet minggu ini.`;
  return tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text });
}
