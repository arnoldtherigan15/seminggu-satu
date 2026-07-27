// Port dari sha256_/hashPassword_/randToken_/waKey_ di Google_Script_Code.js.
// Password tetap disimpan sebagai HASH (SHA-256 + salt), bukan teks asli --
// sama persis kayak sistem lama, biar member.pass_hash lama yang udah
// dimigrasikan (Fase 4f) tetap valid dipakai login.

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  return sha256Hex(`${salt}::${password}`);
}

export function randToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

// Normalisasi nomor WA: "0812.." -> "62812..", "812.." -> "62812.." (kalau
// diketik tanpa 0/62), buang semua karakter non-digit dulu.
export function waKey(input: string | undefined | null): string {
  let d = String(input || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}
