// Web Push standar (RFC 8291 aes128gcm + VAPID RFC 8292) murni WebCrypto --
// tanpa library, jalan di Deno (Edge Function) maupun Node. Dipakai buat push
// ke dashboard admin (PWA), BUKAN OneSignal (itu khusus warga).
//
// Kunci VAPID disimpen sebagai secret:
//   ADMIN_VAPID_PUBLIC       -> public key raw (65 byte) base64url, juga dikasih ke browser
//   ADMIN_VAPID_PRIVATE_JWK  -> private key JWK (JSON string)

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

const enc = new TextEncoder();

export function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8);
  return new Uint8Array(bits);
}

// Enkripsi payload buat 1 subscription (body siap kirim, header Content-Encoding: aes128gcm)
export async function encryptPayload(sub: PushSub, payload: string, saltIn?: Uint8Array, asKeysIn?: CryptoKeyPair): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.keys.p256dh);
  const authSecret = b64urlDecode(sub.keys.auth);
  const asKeys = asKeysIn || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = saltIn || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const plain = concat(enc.encode(payload), new Uint8Array([2])); // 0x02 = record terakhir
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plain));

  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// JWT VAPID (ES256). WebCrypto ECDSA udah ngasih signature format r||s (64 byte) = format JWS.
export async function vapidAuthHeader(endpoint: string, publicB64: string, privateJwk: JsonWebKey, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(header + "." + claims));
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${publicB64}`;
}

// Kirim 1 push. Balikin status HTTP (201 = sukses; 404/410 = subscription udah mati, hapus).
export async function sendWebPush(
  sub: PushSub, payload: string,
  vapid: { publicKey: string; privateJwk: JsonWebKey; subject: string },
  opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string } = {},
): Promise<number> {
  const body = await encryptPayload(sub, payload);
  const headers: Record<string, string> = {
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(opts.ttl ?? 86400),
    Urgency: opts.urgency || "high",
    Authorization: await vapidAuthHeader(sub.endpoint, vapid.publicKey, vapid.privateJwk, vapid.subject),
  };
  if (opts.topic) headers.Topic = opts.topic;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(sub.endpoint, { method: "POST", headers, body, signal: ctrl.signal });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}
