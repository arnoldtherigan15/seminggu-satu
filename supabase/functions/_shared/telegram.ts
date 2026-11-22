import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { waKey } from "./auth.ts";
import { mergeBatchConfig } from "./batch-merge.ts";
import { sendAdminPush, telegramToPush } from "./admin-push.ts";

// Generic sender -- port dari sendTelegram_(). TELEGRAM_TOKEN/TELEGRAM_CHATID
// disimpen sebagai Edge Function secret (supabase secrets set), BUKAN
// hardcode kayak di Google_Script_Code.js dulu (folder ini KE-COMMIT ke git).
// deno-lint-ignore no-explicit-any
export async function sendTelegramText(text: string, replyMarkup?: any, opts?: { url?: string }) {
  // Push ke PWA admin jalan barengan (paralel) sama Telegram -- isi sama.
  // opts.url = halaman admin yang dibuka pas push-nya diketuk (mis. detail order).
  const msg = telegramToPush(text);
  if (opts?.url) msg.url = opts.url;
  const pushP = sendAdminPush(msg).catch(() => {});
  try { await sendTelegramTextOnly(text, replyMarkup); } finally { await pushP; }
}

// deno-lint-ignore no-explicit-any
async function sendTelegramTextOnly(text: string, replyMarkup?: any) {
  const token = Deno.env.get("TELEGRAM_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHATID");
  if (!token || !chatId) return; // belum dikonfigurasi -> diem aja

  // deno-lint-ignore no-explicit-any
  const payload: any = { chat_id: chatId, text, parse_mode: "Markdown" };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  // SEMUA caller (register-workshop, member-setup, submit-order, dll) manggil
  // ini SETELAH data intinya udah sukses kesimpen, notif Telegram ini cuma
  // best-effort (selalu dibungkus try/catch di caller) -- tapi TANPA batas
  // waktu di sini, fetch yang lelet/nge-hang ke API Telegram bisa nahan
  // RESPONSE ke user lama banget walau data aslinya udah aman. BUG nyata yang
  // kejadian: peserta daftar workshop, datanya sukses masuk, tapi browser-nya
  // nyerah duluan nunggu response (client-side timeout 60dtk) sebelum notif
  // Telegram ini kelar -- keliatan kayak "nge-hang", padahal pendaftarannya
  // sendiri udah beres dari awal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function waButton(waRaw: string | undefined, nickname: string, sapaan: string) {
  const waNum = waKey(waRaw);
  if (!waNum) return undefined;
  const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(sapaan)}`;
  return { inline_keyboard: [[{ text: `💬 Sambut ${nickname} di WhatsApp`, url: waUrl }]] };
}

// Port dari kirimNotifTelegram() -- notif ke admin pas ada pendaftar
// workshop baru, + tombol "Sambut di WhatsApp" siap-klik.
export async function notifyRegistration(
  admin: SupabaseClient,
  info: { workshopType: string; label: string; fullName?: string; nickname?: string; whatsapp?: string; batchId?: string },
) {
  if (!Deno.env.get("TELEGRAM_TOKEN")) return;

  // Port dari kirimNotifTelegram() -- dulu "jumlah = sheet.getLastRow()-1", yaitu
  // total di SHEET BATCH itu doang (tiap batch punya sheet sendiri). Di sini
  // registrations udah 1 tabel gabungan, jadi WAJIB difilter per batch_id juga,
  // bukan cuma workshop_type -- kalau nggak, angkanya jadi total SEMUA batch
  // sepanjang masa (bug yang sempet kejadian: nunjukkin 47 padahal batch aktif
  // baru 9 orang).
  let q = admin.from("registrations").select("id", { count: "exact", head: true }).eq("workshop_type", info.workshopType).eq("archived", false);
  if (info.batchId) q = q.eq("batch_id", info.batchId);
  const { count } = await q;

  const pesan =
    "🎉 *Pendaftar Baru!*\n\n" +
    `🎨 Workshop: ${info.label}\n` +
    `👤 Nama: ${info.fullName || "-"}\n` +
    `🏷️ Nickname: ${info.nickname || "-"}\n` +
    `📱 WA: ${info.whatsapp || "-"}\n` +
    `📊 Total di batch ini: *${count ?? "?"}* peserta`;

  const nick = info.nickname || "kak";
  const sapaan = await registrationGreeting(admin, { workshopType: info.workshopType, label: info.label, nickname: info.nickname, batchId: info.batchId });

  await sendTelegramText(pesan, waButton(info.whatsapp, nick, sapaan), {
    url: "/admin/#pendaftar:" + encodeURIComponent(info.workshopType) + (info.batchId ? ":" + encodeURIComponent(info.batchId) : ""),
  });
}

// Link grup WA per batch (batch override > Config tipe workshop). Cache opsional
// biar getActivity (puluhan pendaftar) nggak query berulang.
// BUG lama: dulu cuma dari WORKSHOPS_JSON (level tipe) -> begitu ada 2+ batch
// aktif dengan link beda, link yang dishare bisa SALAH batch.
export async function groupLinkFor(
  admin: SupabaseClient, workshopType: string, batchId?: string,
  cache?: { cfg?: { id: string; whatsappGroupLink?: string }[]; batches?: Map<string, string> },
): Promise<string> {
  try {
    const c = cache || {};
    if (!c.cfg) {
      const { data: cfgRow } = await admin.from("app_config").select("value").eq("key", "WORKSHOPS_JSON").maybeSingle();
      c.cfg = JSON.parse(cfgRow?.value || "[]");
    }
    const typeConfig = (c.cfg || []).find((x) => x.id === workshopType) || {};
    let link = "";
    if (batchId) {
      if (!c.batches) c.batches = new Map();
      if (c.batches.has(batchId)) link = c.batches.get(batchId) || "";
      else {
        const { data: batchRow } = await admin.from("batches").select("*").eq("id", batchId).maybeSingle();
        // deno-lint-ignore no-explicit-any
        link = batchRow ? (mergeBatchConfig(batchRow, typeConfig as any).whatsappGroupLink || "") : "";
        c.batches.set(batchId, link);
      }
    }
    return link || (typeConfig as { whatsappGroupLink?: string }).whatsappGroupLink || "";
  } catch (_e) { return ""; }
}

// Pesan sambutan ke pendaftar (dipake tombol WA di Telegram DAN di Notifikasi admin -- satu sumber).
export async function registrationGreeting(
  admin: SupabaseClient,
  info: { workshopType: string; label: string; nickname?: string; batchId?: string },
  // deno-lint-ignore no-explicit-any
  cache?: any,
): Promise<string> {
  const nick = info.nickname || "kak";
  const groupLink = await groupLinkFor(admin, info.workshopType, info.batchId, cache);
  return `Hai ka ${nick}\n` +
    `Terima kasih banyak ya udah daftar di ${info.label}🙌✨\n` +
    "Biar kamu nggak ketinggalan informasi, yuk langsung gabung ke grup WhatsApp lewat link di bawah ini:\n" +
    `🔗 ${groupLink || "(link grup menyusul ya)"}\n` +
    `Sampai ketemu di keseruan ${info.label}! 🥳`;
}
