// RajaOngkir (Komerce) Shipping Cost API + cache di database biar hemat kuota.
//  - searchDestination : cari kecamatan/kelurahan tujuan (cache per kata kunci)
//  - jneOptions        : layanan JNE + harga (cache per asal|tujuan|kurir|kg)
// Cache berlaku 30 hari; lewat itu, request berikutnya ambil data baru & update cache.
// Key di secret RAJAONGKIR_API_KEY (Supabase secrets), JANGAN di-hardcode.
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

const BASE = "https://rajaongkir.komerce.id/api/v1";
const TTL_MS = 30 * 24 * 3600 * 1000;

export interface Destination { id: number; label: string }
export interface ShipOption { service: string; description: string; cost: number; etd: string }

export function rajaKey(): string { return Deno.env.get("RAJAONGKIR_API_KEY") || ""; }

const fresh = (ts: string | null | undefined) => !!ts && Date.now() - new Date(ts).getTime() < TTL_MS;

async function fetchJson(url: string, init: RequestInit): Promise<any> { // deno-lint-ignore no-explicit-any
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return await res.json();
  } finally { clearTimeout(t); }
}

export async function searchDestination(admin: SupabaseClient, query: string): Promise<Destination[]> {
  const q = query.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
  if (q.length < 3) return [];
  const { data: hit } = await admin.from("shop_dest_cache").select("results, fetched_at").eq("query", q).maybeSingle();
  if (hit && fresh(hit.fetched_at)) return hit.results as Destination[];
  const key = rajaKey();
  if (!key) return hit ? (hit.results as Destination[]) : [];
  try {
    const json = await fetchJson(`${BASE}/destination/domestic-destination?search=${encodeURIComponent(q)}&limit=12`, { headers: { key } });
    if (json?.meta?.status !== "success") return hit ? (hit.results as Destination[]) : [];
    // deno-lint-ignore no-explicit-any
    const results: Destination[] = (json.data || []).map((d: any) => ({ id: Number(d.id), label: String(d.label || "") }));
    await admin.from("shop_dest_cache").upsert({ query: q, results, fetched_at: new Date().toISOString() });
    return results;
  } catch (_e) {
    return hit ? (hit.results as Destination[]) : []; // API error -> pakai cache lama kalau ada
  }
}

// JNE dihitung per kg (dibulatin ke atas) -> cache per kg, hasilnya akurat buat berat berapa pun di kg yang sama
export function weightKg(grams: number): number { return Math.max(1, Math.ceil(Math.max(1, grams) / 1000)); }

export async function jneOptions(admin: SupabaseClient, originId: string, destinationId: number, grams: number): Promise<ShipOption[]> {
  const kg = weightKg(grams);
  const cacheKey = `${originId}|${destinationId}|jne|${kg}`;
  const { data: hit } = await admin.from("shop_ongkir_cache").select("options, fetched_at").eq("cache_key", cacheKey).maybeSingle();
  if (hit && fresh(hit.fetched_at)) return hit.options as ShipOption[];
  const key = rajaKey();
  if (!key) return hit ? (hit.options as ShipOption[]) : [];
  try {
    const body = new URLSearchParams({ origin: String(originId), destination: String(destinationId), weight: String(kg * 1000), courier: "jne" });
    const json = await fetchJson(`${BASE}/calculate/domestic-cost`, {
      method: "POST",
      headers: { key, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (json?.meta?.status !== "success") return hit ? (hit.options as ShipOption[]) : [];
    // JTR = JNE Trucking (kargo besar) -> nggak masuk akal buat paket kecil
    const options: ShipOption[] = (json.data || [])
      // deno-lint-ignore no-explicit-any
      .filter((d: any) => !String(d.service || "").toUpperCase().startsWith("JTR") && Number(d.cost) > 0)
      // deno-lint-ignore no-explicit-any
      .map((d: any) => ({ service: String(d.service), description: String(d.description || ""), cost: Number(d.cost) || 0, etd: String(d.etd || "") }))
      .sort((a: ShipOption, b: ShipOption) => a.cost - b.cost);
    if (options.length) await admin.from("shop_ongkir_cache").upsert({ cache_key: cacheKey, options, fetched_at: new Date().toISOString() });
    return options;
  } catch (_e) {
    return hit ? (hit.options as ShipOption[]) : [];
  }
}
