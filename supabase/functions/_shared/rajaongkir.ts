// Helper tipis buat RajaOngkir (Komerce) Shipping Cost API -- dipake
// shop-ongkir (search alamat tujuan + hitung ongkir) & shop-create-order
// (validasi ulang ongkir server-side sebelum nyimpen pesanan, JANGAN
// pernah percaya shippingCost yang dikirim client).
const BASE = "https://rajaongkir.komerce.id/api/v1";

export interface RajaOngkirDestination {
  id: number;
  label: string;
}

export interface RajaOngkirCostOption {
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export async function searchDestination(apiKey: string, query: string): Promise<RajaOngkirDestination[]> {
  const res = await fetch(`${BASE}/destination/domestic-destination?search=${encodeURIComponent(query)}&limit=10`, {
    headers: { key: apiKey },
  });
  const json = await res.json();
  if (json?.meta?.status !== "success") return [];
  // deno-lint-ignore no-explicit-any
  return (json.data || []).map((d: any) => ({ id: d.id, label: d.label }));
}

export async function calculateCost(
  apiKey: string,
  originId: string,
  destinationId: number,
  weightGrams: number,
  courier = "jne",
): Promise<RajaOngkirCostOption[]> {
  const body = new URLSearchParams({
    origin: String(originId),
    destination: String(destinationId),
    weight: String(Math.max(1, weightGrams)),
    courier,
  });
  const res = await fetch(`${BASE}/calculate/domestic-cost`, {
    method: "POST",
    headers: { key: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (json?.meta?.status !== "success") return [];
  // "JTR*" (JNE Trucking) itu buat kargo/muatan besar, bukan paket retail
  // kecil kayak journaling kit/decopaper -- disaring biar pembeli nggak
  // ketemu opsi "ongkir Rp 800.000" yang membingungkan buat paket kecil.
  return (json.data || [])
    // deno-lint-ignore no-explicit-any
    .filter((d: any) => !String(d.service || "").startsWith("JTR"))
    // deno-lint-ignore no-explicit-any
    .map((d: any) => ({
      service: d.service, description: d.description, cost: Number(d.cost) || 0, etd: d.etd || "",
    }));
}
