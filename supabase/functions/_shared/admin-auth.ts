import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getConfigValue } from "./config.ts";

const SESSION_HOURS = 12;

export type AdminRole = "super" | "assistant";
export type AdminSession = { role: AdminRole; name: string; userId: string | null };

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashAdminPassword(salt: string, password: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`);
}

// Login admin: username + password. Super admin = username ADMIN_USERNAME
// (default "arnold") + password di secret ADMIN_PASSWORD_HASH/ADMIN_SALT
// (folder ini ke-commit ke git, jadi hash-nya nggak boleh di kode). Admin lain
// (asisten) di tabel admin_users, username unik. Gagal = pesan yang sama
// apa pun penyebabnya + jeda, biar nebak beruntun jadi lambat.
// Tiap login bikin 1 baris admin_sessions -> login di HP nggak nendang laptop.
export function superUsername(): string {
  return (Deno.env.get("ADMIN_USERNAME") || "arnold").trim().toLowerCase();
}
export function cleanUsername(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}
export async function adminLogin(admin: SupabaseClient, usernameRaw: string, password: string): Promise<{ token: string; role: AdminRole; name: string } | { error: string }> {
  const username = cleanUsername(usernameRaw);
  const fail = async () => { await new Promise((r) => setTimeout(r, 700)); return { error: "Username atau password salah." }; };
  if (!username || !password) return { error: "Isi username dan password dulu." };
  let session: AdminSession | null = null;

  if (username === superUsername()) {
    const hash = Deno.env.get("ADMIN_PASSWORD_HASH");
    const salt = Deno.env.get("ADMIN_SALT");
    if (!hash || !salt) return { error: "Password admin belum di-set (ADMIN_PASSWORD_HASH/ADMIN_SALT secret)." };
    if ((await hashAdminPassword(salt, password)) === hash) session = { role: "super", name: "Arnold", userId: null };
  } else {
    const { data: u } = await admin.from("admin_users").select("id, name, role, pass_hash, salt, active").eq("username", username).maybeSingle();
    if (u && u.active && (await hashAdminPassword(u.salt, password)) === u.pass_hash) {
      session = { role: u.role as AdminRole, name: u.name, userId: u.id };
      await admin.from("admin_users").update({ last_login: new Date().toISOString() }).eq("id", u.id);
    }
  }
  if (!session) return await fail();

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const { error: insErr } = await admin.from("admin_sessions").insert({ token, user_id: session.userId, role: session.role, name: session.name, expires_at: expires });
  if (insErr) return { error: "Gagal bikin sesi login: " + insErr.message };
  // bersih-bersih sesi kedaluwarsa (best-effort)
  await admin.from("admin_sessions").delete().lt("expires_at", new Date().toISOString());
  return { token, role: session.role, name: session.name };
}

export async function adminLogout(admin: SupabaseClient, token: string) {
  if (token) await admin.from("admin_sessions").delete().eq("token", token);
}

// Lempar Error kalau sesi invalid/kadaluarsa; balikin role + nama kalau valid.
export async function requireAdminAuth(admin: SupabaseClient, token: string): Promise<AdminSession> {
  if (!token) throw new Error("Sesi tidak valid. Silakan login ulang.");
  const { data: s } = await admin.from("admin_sessions").select("role, name, user_id, expires_at").eq("token", token).maybeSingle();
  if (s) {
    if (Date.now() > new Date(s.expires_at).getTime()) throw new Error("Sesi kedaluwarsa. Silakan login ulang.");
    if (s.user_id) {
      // akun dinonaktifkan/dihapus -> sesinya ikut mati
      const { data: u } = await admin.from("admin_users").select("active, role, name").eq("id", s.user_id).maybeSingle();
      if (!u || !u.active) throw new Error("Sesi tidak valid. Silakan login ulang.");
      return { role: u.role as AdminRole, name: u.name, userId: s.user_id };
    }
    return { role: s.role as AdminRole, name: s.name, userId: null };
  }
  // Sesi model lama (1 token di app_config) tetap diterima sampai kedaluwarsa,
  // biar deploy ini nggak nge-logout admin yang lagi login.
  const saved = await getConfigValue(admin, "ADMIN_SESSION_TOKEN");
  const expiry = parseInt((await getConfigValue(admin, "ADMIN_SESSION_EXPIRY")) || "0", 10);
  if (saved && token === saved && Date.now() <= expiry) return { role: "super", name: "Super admin", userId: null };
  throw new Error("Sesi tidak valid. Silakan login ulang.");
}

// Aksi admin-api yang boleh dipakai asisten: cuma kebutuhan hari-H event
// (Pendaftar, Prep, Pesanan minum). Sisanya (pendapatan, keuangan, config,
// konten, member, partner, data pribadi) khusus super admin -- dicek di server.
export const ASSISTANT_ACTIONS = new Set([
  "whoami", "logout",
  "getRegistrations", "archiveRegistration", "listBatches", "listAllBatches", "setAttendance", "getSignedUrl",
  "getPrep", "savePrep", "getPrepFaqContext", "savePrepFaqContext", "getPrepFaqList", "savePrepFaqList",
  "getPrepPartnerRequests", "savePrepPartnerRequests", "pullPrepPartnerRequests", "generateFaqAnswer", "generateReminderMessage",
  "listPartners", "getConfig",
  "listMenuItems", "listOrders", "saveOrder", "deleteOrder", "getVendorWa",
]);
