// Helper bareng buat Toko -- dipake shop-create-order & admin-api (reviewShopOrder).

// "SS-20261007-AB3F" -- kode pesanan yang gampang disebut manusia (chat
// WA/konfirmasi transfer), bukan UUID mentah.
export function genOrderCode(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `SS-${ymd}-${rand}`;
}

// Berapa lama stok direservasi sebelum pesanan yang belum diupload bukti
// bayarnya dianggap hangus (dilepas balik oleh cron-release-expired-shop-orders).
export const RESERVE_MINUTES = 60 * 24; // 24 jam

export function reservedUntilIso(): string {
  return new Date(Date.now() + RESERVE_MINUTES * 60 * 1000).toISOString();
}
