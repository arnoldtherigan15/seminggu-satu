// AES-256-GCM buat enkripsi password di Personal > Password Manager --
// password DISIMPAN TERENKRIPSI di DB (bukan plaintext), pakai key yang
// cuma ada di server (Supabase secret VAULT_KEY). Jadi walau tabelnya
// somehow kebocor/kebaca orang lain, isi passwordnya tetap nggak kebaca
// tanpa key itu. Key beda antara dev & prod (sengaja, biar breach di satu
// project nggak ikut buka data project satunya).
const IV_LEN = 12; // bytes, standar buat AES-GCM

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("VAULT_KEY");
  if (!raw) throw new Error("VAULT_KEY belum diset di server.");
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Balikin base64(iv + ciphertext) -- iv random tiap panggilan biar 2
// password yang sama isinya nggak keliatan identik di DB.
export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  let bin = "";
  combined.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

export async function decryptSecret(encoded: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LEN);
  const data = combined.slice(IV_LEN);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}
