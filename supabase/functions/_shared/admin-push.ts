// Push ke dashboard admin (PWA yang di-"Add to Home Screen"). Dipanggil
// otomatis dari sendTelegramText -- jadi SEMUA notif yang masuk Telegram
// admin (pendaftar, warga aktivasi, challenge, kotak pos, pesanan, dst)
// juga muncul sebagai push di HP. Best-effort: gagal = diem, nggak ganggu
// alur utama. Subscription yang udah mati (404/410) dihapus.
import { supabaseAdmin } from "./supabase-admin.ts";
import { sendWebPush, type PushSub } from "./webpush.ts";

export function adminVapid() {
  const publicKey = Deno.env.get("ADMIN_VAPID_PUBLIC") || "";
  const raw = Deno.env.get("ADMIN_VAPID_PRIVATE_JWK") || "";
  if (!publicKey || !raw) return null;
  try { return { publicKey, privateJwk: JSON.parse(raw) as JsonWebKey, subject: "https://seminggusatu.com" }; } catch (_e) { return null; }
}

export async function sendAdminPush(msg: { title: string; body: string; url?: string; tag?: string }) {
  const vapid = adminVapid();
  if (!vapid) return;
  try {
    const admin = supabaseAdmin();
    const { data: subs } = await admin.from("admin_push_subscriptions").select("id, endpoint, p256dh, auth");
    if (!subs || !subs.length) return;
    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url || "/admin/#activity", tag: msg.tag || "" });
    const dead: string[] = [];
    await Promise.all(subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        const sub: PushSub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
        const st = await sendWebPush(sub, payload, vapid, { urgency: "high" });
        if (st === 404 || st === 410) dead.push(s.id);
        else if (st >= 200 && st < 300) await admin.from("admin_push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
      } catch (_e) { /* abaikan per subscription */ }
    }));
    if (dead.length) await admin.from("admin_push_subscriptions").delete().in("id", dead);
  } catch (_e) { /* best-effort */ }
}

// Teks Telegram (Markdown) -> judul + isi push yang rapi.
// Baris pertama = judul ("🎉 *Pendaftar Baru!*" -> "Pendaftar Baru!"), sisanya isi.
export function telegramToPush(text: string): { title: string; body: string; url: string } {
  const lines = String(text || "").split("\n").map((l) => l.replace(/[*_`]/g, "").trim()).filter(Boolean);
  const strip = (l: string) => l.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const title = strip(lines[0] || "Seminggu Satu");
  const body = lines.slice(1).map(strip).join(" · ").slice(0, 220);
  const t = title.toLowerCase();
  const url = t.includes("pendaftar") ? "/admin/#activity"
    : t.includes("warga") ? "/admin/#activity"
    : t.includes("challenge") ? "/admin/#quest"
    : t.includes("kotak pos") ? "/admin/#activity"
    : t.includes("pesanan") ? "/admin/#pesanan"
    : "/admin/#activity";
  return { title, body, url };
}
