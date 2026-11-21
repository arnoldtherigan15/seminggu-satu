// Helper bot Telegram "Catat keuangan". Pakai bot yang SAMA dengan notif
// pendaftar (secret TELEGRAM_TOKEN, cuma ada di project production) -- jadi
// nggak perlu bikin bot baru. State-nya (secret webhook, chat id yang di-link,
// kode link sementara) disimpan di personal_settings (service role only).

// deno-lint-ignore no-explicit-any
type Admin = any;

export const PROD_REF = "anztympwvfjgkpycgdvm";
export function isProdProject(): boolean { return (Deno.env.get("SUPABASE_URL") || "").includes(PROD_REF); }

export async function getSettings(admin: Admin, keys: string[]): Promise<Record<string, string>> {
  const { data } = await admin.from("personal_settings").select("key, value").in("key", keys);
  const out: Record<string, string> = {};
  for (const r of data || []) out[r.key] = r.value;
  return out;
}
export async function setSettings(admin: Admin, kv: Record<string, string | null>): Promise<void> {
  const now = new Date().toISOString();
  const up = Object.entries(kv).filter(([, v]) => v !== null).map(([key, value]) => ({ key, value: value as string, updated_at: now }));
  const del = Object.entries(kv).filter(([, v]) => v === null).map(([k]) => k);
  if (up.length) { const { error } = await admin.from("personal_settings").upsert(up); if (error) throw new Error(error.message); }
  if (del.length) await admin.from("personal_settings").delete().in("key", del);
}
// deno-lint-ignore no-explicit-any
export async function tg(method: string, body: Record<string, unknown> = {}): Promise<any> {
  const token = Deno.env.get("TELEGRAM_TOKEN");
  if (!token) return { ok: false, description: "TELEGRAM_TOKEN belum diset di project ini." };
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal,
    });
    return await res.json().catch(() => ({ ok: false, description: "Respon Telegram nggak kebaca." }));
  } catch (e) { return { ok: false, description: (e as Error).message }; }
  finally { clearTimeout(t); }
}
export function randomHex(bytes = 24): string {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const escHtml = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
