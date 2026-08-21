import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { waKey } from "./auth.ts";

// Generic sender -- port dari sendTelegram_(). TELEGRAM_TOKEN/TELEGRAM_CHATID
// disimpen sebagai Edge Function secret (supabase secrets set), BUKAN
// hardcode kayak di Google_Script_Code.js dulu (folder ini KE-COMMIT ke git).
// deno-lint-ignore no-explicit-any
export async function sendTelegramText(text: string, replyMarkup?: any) {
  const token = Deno.env.get("TELEGRAM_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHATID");
  if (!token || !chatId) return; // belum dikonfigurasi -> diem aja

  // deno-lint-ignore no-explicit-any
  const payload: any = { chat_id: chatId, text, parse_mode: "Markdown" };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  let groupLink = "";
  try {
    const { data: cfgRow } = await admin.from("app_config").select("value").eq("key", "WORKSHOPS_JSON").maybeSingle();
    const cfg = JSON.parse(cfgRow?.value || "[]");
    const w = cfg.find((x: { id: string }) => x.id === info.workshopType);
    if (w?.whatsappGroupLink) groupLink = w.whatsappGroupLink;
  } catch (_e) { /* abaikan */ }

  const sapaan =
    `Hai ka ${nick}\n` +
    `Terima kasih banyak ya udah daftar di ${info.label}🙌✨\n` +
    "Biar kamu nggak ketinggalan informasi, yuk langsung gabung ke grup WhatsApp lewat link di bawah ini:\n" +
    `🔗 ${groupLink || "(link grup menyusul ya)"}\n` +
    `Sampai ketemu di keseruan ${info.label}! 🥳`;

  await sendTelegramText(pesan, waButton(info.whatsapp, nick, sapaan));
}
