// Webhook bot Telegram buat catat keuangan pribadi Arnold dari HP:
//   "kopi 25rb"            -> langsung kecatat (parser sama kayak Catat cepat di admin)
//   foto struk             -> dibaca AI (Gemini) -> dicatat
//   /hariini /bulanini /saldo /batal /bantuan
// Keamanan: (1) header X-Telegram-Bot-Api-Secret-Token wajib cocok sama secret
// yang di-set pas "Hubungkan" dari admin, (2) cuma chat yang udah di-link
// (lewat /start <kode sekali pakai>) yang dilayani.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { parseQuickTx, todayWib, rp } from "../_shared/quick-tx.ts";
import { getSettings, setSettings, tg, escHtml } from "../_shared/tg-finance.ts";
import { callGemini } from "../_shared/gemini.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;
const ok = () => new Response("ok");

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok();
  const admin = supabaseAdmin();
  const s = await getSettings(admin, ["tg_webhook_secret", "tg_chat_id", "tg_link_code", "tg_link_exp"]);
  if (!s.tg_webhook_secret || req.headers.get("x-telegram-bot-api-secret-token") !== s.tg_webhook_secret) return new Response("forbidden", { status: 403 });
  // deno-lint-ignore no-explicit-any
  let upd: any;
  try { upd = await req.json(); } catch (_e) { return ok(); }
  try { await handle(admin, upd, s); } catch (e) { console.error("telegram-finance", e); }
  return ok(); // selalu 200 -- kalau nggak, Telegram ngirim ulang terus
});

// deno-lint-ignore no-explicit-any
async function handle(admin: Admin, upd: any, s: Record<string, string>) {
  if (upd.callback_query) return handleCallback(admin, upd.callback_query, s);
  const msg = upd.message;
  if (!msg || !msg.chat) return;
  const chatId = String(msg.chat.id);
  const text: string = (msg.text || msg.caption || "").trim();

  // /start <kode> -> link chat ini (kode dari tombol "Hubungkan" di admin, 15 menit)
  if (/^\/start\b/.test(text)) {
    const code = text.split(/\s+/)[1] || "";
    if (code && s.tg_link_code && code === s.tg_link_code && Number(s.tg_link_exp || 0) > Date.now()) {
      await setSettings(admin, { tg_chat_id: chatId, tg_link_code: null, tg_link_exp: null, tg_chat_name: [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(" ") || msg.chat.username || "" });
      return send(chatId, `Tersambung! Sekarang kamu bisa catat keuangan dari sini.\n\n${HELP}`);
    }
    if (s.tg_chat_id === chatId) return send(chatId, HELP);
    return send(chatId, "Bot ini privat. Buka admin Seminggu Satu > Keuangan pribadi > Hubungkan Telegram buat nyambungin.");
  }
  if (!s.tg_chat_id || s.tg_chat_id !== chatId) return; // chat lain: diem

  if (/^\/(bantuan|help)\b/.test(text)) return send(chatId, HELP);
  if (/^\/saldo\b/.test(text)) return send(chatId, await saldoText(admin));
  if (/^\/hariini\b/.test(text)) return send(chatId, await todayText(admin));
  if (/^\/bulanini\b/.test(text)) return send(chatId, await monthText(admin));
  if (/^\/batal\b/.test(text)) {
    const { data: last } = await admin.from("personal_transactions").select("*").eq("source", "telegram").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) return send(chatId, "Belum ada yang dicatat dari Telegram.");
    await admin.from("personal_transactions").delete().eq("id", last.id);
    return send(chatId, `Dibatalkan: ${escHtml(last.note || "Transaksi")} · ${rp(last.amount)}`);
  }

  // foto struk -> AI baca total & nama toko, terus diproses kayak teks biasa
  let input = text;
  let fromPhoto = false;
  if (msg.photo && msg.photo.length) {
    const read = await readReceipt(msg.photo[msg.photo.length - 1].file_id);
    if (!read.ok) return send(chatId, read.error || "Struknya belum kebaca. Coba ketik aja, mis. \"indomaret 45rb\".");
    input = `${read.merchant || "Belanja"} ${read.total}${read.date ? " " + read.date : ""} ${text}`.trim();
    fromPhoto = true;
  }
  if (!input) return;
  const ctx = await loadCtx(admin);
  const p = parseQuickTx(input, ctx);
  if (!p.ok) return send(chatId, `${escHtml(p.error || "Belum kebaca.")}\n\nContoh: <code>kopi 25rb</code>, <code>grab 32k gopay kemarin</code>, <code>gaji 8jt masuk bca</code>`);
  if (p.type === "transfer" && (!p.toAccountId || p.toAccountId === p.accountId)) return send(chatId, "Transfer butuh akun tujuan yang beda. Tulis mis. <code>tf 500rb bca ke gopay</code>.");
  const { data: row, error } = await admin.from("personal_transactions").insert({
    date: p.date, type: p.type, amount: p.amount, account_id: p.accountId,
    to_account_id: p.type === "transfer" ? p.toAccountId : null, category_id: p.type === "transfer" ? null : p.categoryId,
    note: p.note ? p.note.slice(0, 300) : null, source: "telegram",
  }).select("*").single();
  if (error) return send(chatId, "Gagal nyimpen: " + escHtml(error.message));
  return send(chatId, txText(row, ctx, fromPhoto), txKeyboard(row));
}

const HELP = [
  "<b>Cara catat</b> -- ketik aja kayak chat:",
  "<code>kopi 25rb</code>",
  "<code>grab 32k gopay kemarin</code>",
  "<code>gaji 8jt masuk bca</code>",
  "<code>tf 500rb bca ke gopay</code>",
  "Atau kirim <b>foto struk</b>.",
  "",
  "/hariini · /bulanini · /saldo · /batal (batalin catatan terakhir)",
].join("\n");

// deno-lint-ignore no-explicit-any
async function send(chatId: string, text: string, reply_markup?: any) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });
}
async function loadCtx(admin: Admin) {
  const [a, c, h] = await Promise.all([
    admin.from("personal_accounts").select("id, name, type, archived"),
    admin.from("personal_categories").select("id, name, type, archived"),
    admin.from("personal_transactions").select("note, category_id, account_id, type").order("created_at", { ascending: false }).limit(400),
  ]);
  return { accounts: a.data || [], categories: c.data || [], history: h.data || [] };
}
function dayLabel(iso: string) {
  const today = todayWib();
  if (iso === today) return "hari ini";
  const y = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  if (iso === y) return "kemarin";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
// deno-lint-ignore no-explicit-any
function txText(t: any, ctx: { accounts: any[]; categories: any[] }, fromPhoto = false) {
  const acc = (id: string) => (ctx.accounts.find((a) => a.id === id) || {}).name || "?";
  const cat = ctx.categories.find((c) => c.id === t.category_id);
  const head = t.type === "income" ? "Pemasukan kecatat" : t.type === "transfer" ? "Transfer kecatat" : "Kecatat";
  const where = t.type === "transfer" ? `${acc(t.account_id)} → ${acc(t.to_account_id)}` : [cat ? cat.name : "Tanpa kategori", acc(t.account_id)].join(" · ");
  return `<b>${head}${fromPhoto ? " (dari foto)" : ""}</b>\n${escHtml(t.note || "Transaksi")} · <b>${t.type === "expense" ? "−" : t.type === "income" ? "+" : ""}${rp(t.amount)}</b>\n${escHtml(where)} · ${dayLabel(t.date)}`;
}
// deno-lint-ignore no-explicit-any
function txKeyboard(t: any) {
  const row = [{ text: "Batalkan", callback_data: "u:" + t.id }];
  if (t.type !== "transfer") row.unshift({ text: "Ganti kategori", callback_data: "c:" + t.id });
  return { inline_keyboard: [row] };
}
// deno-lint-ignore no-explicit-any
async function handleCallback(admin: Admin, q: any, s: Record<string, string>) {
  const chatId = String(q.message?.chat?.id || "");
  const answer = (text = "") => tg("answerCallbackQuery", { callback_query_id: q.id, text });
  if (!s.tg_chat_id || chatId !== s.tg_chat_id) return answer();
  const data: string = q.data || "";
  const [kind, id, extra] = data.split(":");
  if (kind === "bp") return payBillFromChat(admin, q, chatId, id, answer);
  const { data: t } = await admin.from("personal_transactions").select("*").eq("id", id).maybeSingle();
  if (!t) { await answer("Transaksinya udah nggak ada."); return tg("editMessageReplyMarkup", { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }); }
  const ctx = await loadCtx(admin);
  const cats = ctx.categories.filter((c: { type: string; archived?: boolean }) => c.type === t.type && !c.archived).sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "id"));
  if (kind === "u") {
    await admin.from("personal_transactions").delete().eq("id", id);
    await answer("Dibatalkan");
    return tg("editMessageText", { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML", text: `<s>${escHtml(t.note || "Transaksi")} · ${rp(t.amount)}</s>\nDibatalkan.` });
  }
  if (kind === "c") { // tampilin pilihan kategori (callback_data max 64 byte -> pakai nomor urut)
    await answer();
    const rows = [];
    for (let i = 0; i < cats.length; i += 2) rows.push(cats.slice(i, i + 2).map((c: { id: string; name: string }, j: number) => ({ text: (c.id === t.category_id ? "• " : "") + c.name, callback_data: `s:${id}:${i + j}` })));
    rows.push([{ text: "‹ Balik", callback_data: "b:" + id }]);
    return tg("editMessageReplyMarkup", { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: rows } });
  }
  if (kind === "s") {
    const c = cats[Number(extra)];
    if (c) { await admin.from("personal_transactions").update({ category_id: c.id }).eq("id", id); t.category_id = c.id; }
    await answer(c ? "Kategori: " + c.name : "");
  } else await answer();
  return tg("editMessageText", { chat_id: chatId, message_id: q.message.message_id, parse_mode: "HTML", text: txText(t, ctx), reply_markup: txKeyboard(t) });
}

// ---------- ringkasan ----------
// deno-lint-ignore no-explicit-any
function sumBy(list: any[], type: string) { return list.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0); }
async function todayText(admin: Admin) {
  const today = todayWib();
  const { data } = await admin.from("personal_transactions").select("*").eq("date", today).order("created_at", { ascending: true });
  const list = data || [];
  if (!list.length) return "Hari ini belum ada yang dicatat.";
  const ctx = await loadCtx(admin);
  const lines = list.map((t: { type: string; note: string; amount: number; category_id: string }) => {
    const cat = ctx.categories.find((c: { id: string }) => c.id === t.category_id);
    return `${t.type === "expense" ? "−" : t.type === "income" ? "+" : "↔"}${rp(t.amount)}  ${escHtml(t.note || (cat ? cat.name : "Transaksi"))}`;
  });
  return `<b>Hari ini</b> · keluar ${rp(sumBy(list, "expense"))}${sumBy(list, "income") ? " · masuk " + rp(sumBy(list, "income")) : ""}\n\n${lines.join("\n")}`;
}
async function monthText(admin: Admin) {
  const today = todayWib(), from = today.slice(0, 8) + "01";
  const { data } = await admin.from("personal_transactions").select("type, amount, category_id").gte("date", from).lte("date", today);
  const list = data || [];
  const ctx = await loadCtx(admin);
  const byCat = new Map<string, number>();
  for (const t of list) if (t.type === "expense") byCat.set(t.category_id || "-", (byCat.get(t.category_id || "-") || 0) + Number(t.amount));
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => `${escHtml((ctx.categories.find((c: { id: string }) => c.id === id) || { name: "Tanpa kategori" }).name)}: ${rp(v)}`);
  const month = new Date(today + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  return `<b>${month}</b>\nMasuk ${rp(sumBy(list, "income"))} · Keluar ${rp(sumBy(list, "expense"))}${top.length ? "\n\n<b>Pengeluaran terbesar</b>\n" + top.join("\n") : ""}`;
}
async function saldoText(admin: Admin) {
  const [a, t] = await Promise.all([
    admin.from("personal_accounts").select("id, name, initial_balance, archived"),
    admin.from("personal_transactions").select("type, amount, account_id, to_account_id"),
  ]);
  const bal = new Map<string, number>();
  for (const acc of a.data || []) bal.set(acc.id, Number(acc.initial_balance) || 0);
  for (const x of t.data || []) {
    const v = Number(x.amount);
    if (x.type === "income") bal.set(x.account_id, (bal.get(x.account_id) || 0) + v);
    else if (x.type === "expense") bal.set(x.account_id, (bal.get(x.account_id) || 0) - v);
    else if (x.type === "transfer") { bal.set(x.account_id, (bal.get(x.account_id) || 0) - v); if (x.to_account_id) bal.set(x.to_account_id, (bal.get(x.to_account_id) || 0) + v); }
  }
  const rows = (a.data || []).filter((x: { archived: boolean }) => !x.archived).map((x: { id: string; name: string }) => `${escHtml(x.name)}: <b>${rp(bal.get(x.id) || 0)}</b>`);
  const total = (a.data || []).filter((x: { archived: boolean }) => !x.archived).reduce((s: number, x: { id: string }) => s + (bal.get(x.id) || 0), 0);
  return `<b>Saldo</b>\n${rows.join("\n")}\n\nTotal: <b>${rp(total)}</b>`;
}

// ---------- foto struk ----------
async function readReceipt(fileId: string): Promise<{ ok: boolean; error?: string; merchant?: string; total?: number; date?: string }> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return { ok: false, error: "Baca foto belum aktif (GEMINI_API_KEY belum diset)." };
  const f = await tg("getFile", { file_id: fileId });
  if (!f.ok) return { ok: false, error: "Fotonya nggak bisa diunduh dari Telegram." };
  const res = await fetch(`https://api.telegram.org/file/bot${Deno.env.get("TELEGRAM_TOKEN")}/${f.result.file_path}`);
  if (!res.ok) return { ok: false, error: "Fotonya nggak bisa diunduh dari Telegram." };
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const prompt = `Ini foto struk/nota/bukti bayar. Ambil: merchant (nama toko/aplikasi, singkat), total (angka bulat Rupiah yang DIBAYAR, tanpa titik), date (YYYY-MM-DD kalau kelihatan, kalau nggak null). Kalau bukan struk, total = 0.`;
  const r = await callGemini(key, prompt, {
    imageBase64: btoa(bin), mimeType: "image/jpeg", temperature: 0,
    responseSchema: { type: "OBJECT", properties: { merchant: { type: "STRING" }, total: { type: "NUMBER" }, date: { type: "STRING", nullable: true } }, required: ["merchant", "total"] },
  });
  if (!r.ok || !r.text) return { ok: false, error: "AI-nya lagi nggak bisa baca foto. Coba ketik aja ya." };
  try {
    const j = JSON.parse(r.text);
    const total = Math.round(Number(j.total) || 0);
    if (total <= 0) return { ok: false, error: "Total di fotonya nggak kebaca. Coba ketik aja, mis. \"indomaret 45rb\"." };
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(j.date || "")) && j.date <= todayWib() ? `${j.date.slice(8, 10)}/${j.date.slice(5, 7)}/${j.date.slice(0, 4)}` : "";
    return { ok: true, merchant: String(j.merchant || "").replace(/\d+/g, "").trim().slice(0, 60), total, date };
  } catch (_e) { return { ok: false, error: "Hasil bacaan fotonya aneh. Coba ketik aja ya." }; }
}

// Tombol "Lunas & catat" dari pengingat tagihan (cron-finance-telegram):
// catat pengeluaran dari akun yang paling sering dipakai + tandai lunas.
// deno-lint-ignore no-explicit-any
async function payBillFromChat(admin: Admin, q: any, chatId: string, billId: string, answer: (t?: string) => Promise<unknown>) {
  const { data: bill } = await admin.from("personal_bills").select("id, name, amount, reset_day").eq("id", billId).maybeSingle();
  if (!bill) { await answer("Tagihannya nggak ketemu."); return; }
  // periode = periode yang jatuh temponya (besok atau hari ini) -- sama kayak billPeriodKey di admin
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  const iso = d.toISOString().slice(0, 10);
  let y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1;
  if (Number(iso.slice(8, 10)) + 1 < bill.reset_day) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  const periodKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const { data: already } = await admin.from("personal_bill_payments").select("id").eq("bill_id", billId).eq("period_key", periodKey).maybeSingle();
  if (already) { await answer("Udah lunas."); return tg("editMessageReplyMarkup", { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }); }
  const ctx = await loadCtx(admin);
  const cnt = new Map<string, number>();
  for (const h of ctx.history.slice(0, 200)) cnt.set(h.account_id, (cnt.get(h.account_id) || 0) + 1);
  const ok = ctx.accounts.filter((a: { archived?: boolean }) => !a.archived);
  const accId = ([...cnt.entries()].filter(([id]) => ok.some((a: { id: string }) => a.id === id)).sort((a, b) => b[1] - a[1])[0] || [ok[0] && ok[0].id])[0];
  if (!accId) { await answer("Belum ada akun."); return; }
  const cat = ctx.categories.find((c: { type: string; name: string; archived?: boolean }) => c.type === "expense" && !c.archived && /tagihan|langganan/i.test(c.name));
  const { data: tx, error } = await admin.from("personal_transactions").insert({
    date: iso, type: "expense", amount: bill.amount, account_id: accId, category_id: cat ? cat.id : null, note: bill.name, source: "bill",
  }).select("id").single();
  if (error) { await answer("Gagal nyatet."); return; }
  await admin.from("personal_bill_payments").upsert({ bill_id: billId, period_key: periodKey, transaction_id: tx.id }, { onConflict: "bill_id,period_key" });
  const accName = (ok.find((a: { id: string }) => a.id === accId) || { name: "?" }).name;
  await answer("Lunas & kecatat");
  return send(chatId, `Lunas: ${escHtml(bill.name)} · <b>${rp(bill.amount)}</b>
Kecatat dari ${escHtml(accName)}.`, { inline_keyboard: [[{ text: "Batalkan", callback_data: "u:" + tx.id }]] });
}
