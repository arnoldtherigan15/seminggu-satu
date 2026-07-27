import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getConfigValue, setConfigValue } from "./config.ts";

const SESSION_HOURS = 12;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Port dari adminLogin() -- ADMIN_PASSWORD_HASH/ADMIN_SALT sekarang Edge
// Function secret (bukan hardcode -- folder ini KE-COMMIT ke git), sesi
// (1 admin, 1 sesi aktif) disimpen di app_config -- sama polanya kayak
// PropertiesService dulu.
export async function adminLogin(admin: SupabaseClient, password: string): Promise<{ token: string } | { error: string }> {
  const hash = Deno.env.get("ADMIN_PASSWORD_HASH");
  const salt = Deno.env.get("ADMIN_SALT");
  if (!hash || !salt) return { error: "Password admin belum di-set (ADMIN_PASSWORD_HASH/ADMIN_SALT secret)." };
  if ((await sha256Hex(`${salt}:${password}`)) !== hash) return { error: "Password salah." };

  const token = crypto.randomUUID();
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  await setConfigValue(admin, "ADMIN_SESSION_TOKEN", token);
  await setConfigValue(admin, "ADMIN_SESSION_EXPIRY", String(expiry));
  return { token };
}

// Port dari requireAuth() -- lempar Error kalau sesi invalid/kadaluarsa.
export async function requireAdminAuth(admin: SupabaseClient, token: string) {
  const saved = await getConfigValue(admin, "ADMIN_SESSION_TOKEN");
  const expiry = parseInt((await getConfigValue(admin, "ADMIN_SESSION_EXPIRY")) || "0", 10);
  if (!token || token !== saved) throw new Error("Sesi tidak valid. Silakan login ulang.");
  if (Date.now() > expiry) throw new Error("Sesi kedaluwarsa. Silakan login ulang.");
}
