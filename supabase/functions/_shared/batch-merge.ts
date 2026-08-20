// Gabungin data batch (Vol 1/Vol 2/dst -- tabel `batches`) sama Config
// workshop (satu blob per TIPE workshop, `WORKSHOPS_JSON`) -- batch menang
// kalau field-nya keisi, kalau kosong balik pakai Config. Port dari pola yang
// sama persis kayak getPrepEventInfo() di admin/index.html, biar aturan
// "batch > Config" cuma ditulis SEKALI (server), bukan kebagi 2 (admin
// client-side + backend) yang gampang beda sendiri-sendiri lama-lama.
//
// Dipakai oleh workshop-batches (endpoint publik) & register-workshop
// (validasi kuota/harga pas submit).

// deno-lint-ignore no-explicit-any
export type TypeConfig = Record<string, any>;
// deno-lint-ignore no-explicit-any
export type BatchRow = Record<string, any>;

// "11/07/2026" (format Config, DD/MM/YYYY) -> "2026-07-11" (ISO) -- batch
// nyimpen tanggal native `date` (udah ISO), Config masih teks bebas DD/MM/YYYY,
// disamain ke ISO di sini biar perbandingan tanggal di server nggak dobel logic.
function idDateToIso(s: unknown): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || "").trim());
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const ID_MONTHS_ = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
// "2026-08-17" -> "17 Agustus 2026" -- port dari formatDateIndo() punya
// workshop-config.js, dipakai buat nurunin displayDate dari tanggal batch
// SENDIRI (bukan Config) pas batch itu belum diisi teks tampilan manual --
// tanpa ini, batch lama tanpa workshop_date bakal nampilin displayDate
// Config (bisa punya batch lain) yang salah.
function formatDateIndoIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${d.getDate()} ${ID_MONTHS_[d.getMonth()]} ${d.getFullYear()}`;
}

export interface MergedBatch {
  id: string;
  label: string;
  active: boolean;
  eventDateIso: string | null;
  displayDate: string;
  workshopTime: string;
  locationName: string;
  mapsLink: string;
  whatsappGroupLink: string;
  normalPrice: number;
  earlyBirdPrice: number | null;
  earlyBirdDueDateIso: string | null;
  earlyBirdMaxCount: number | null;
  maxQuota: number;
  openDateIso: string | null;
  closeDateIso: string | null;
}

export function mergeBatchConfig(batch: BatchRow, typeConfig: TypeConfig): MergedBatch {
  return {
    id: batch.id,
    label: batch.label || "",
    active: !!batch.active,
    eventDateIso: batch.event_date || idDateToIso(typeConfig.eventDate),
    // Prioritas: teks tampilan manual batch > diturunin dari tanggal batch
    // SENDIRI > teks tampilan Config (fallback terakhir, cuma kepake kalau
    // batch ini belum pernah diisi tanggal maupun teksnya sendiri).
    displayDate: batch.workshop_date || (batch.event_date ? formatDateIndoIso(batch.event_date) : "") || typeConfig.workshopDate || "",
    workshopTime: batch.workshop_time || typeConfig.workshopTime || "",
    locationName: batch.location_name || typeConfig.locationName || "",
    mapsLink: batch.maps_link || typeConfig.mapsLink || "",
    whatsappGroupLink: batch.whatsapp_group_link || typeConfig.whatsappGroupLink || "",
    normalPrice: Number(batch.normal_price ?? typeConfig.normalPrice) || 0,
    earlyBirdPrice: batch.early_bird_price != null
      ? Number(batch.early_bird_price)
      : (typeConfig.earlyBirdPrice != null ? Number(typeConfig.earlyBirdPrice) : null),
    earlyBirdDueDateIso: batch.early_bird_due_date || idDateToIso(typeConfig.earlyBirdDueDate),
    earlyBirdMaxCount: batch.early_bird_max_count != null
      ? Number(batch.early_bird_max_count)
      : (typeConfig.earlyBirdMaxCount != null ? Number(typeConfig.earlyBirdMaxCount) : null),
    maxQuota: Number(batch.max_quota ?? typeConfig.maxQuota) || 0,
    openDateIso: batch.open_date || idDateToIso(typeConfig.openDate),
    closeDateIso: batch.close_date || idDateToIso(typeConfig.closeDate),
  };
}

// Versi server dari getWorkshopStatus() (workshop-config.js) -- "open" kalau
// batch-nya active DAN (openDate/closeDate diisi) hari ini masih di windownya.
export function isBatchOpen(m: MergedBatch): boolean {
  if (!m.active) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (m.openDateIso) {
    const open = new Date(m.openDateIso + "T00:00:00");
    if (today < open) return false;
  }
  if (m.closeDateIso) {
    const close = new Date(m.closeDateIso + "T00:00:00");
    if (today > close) return false;
  } else if (m.eventDateIso) {
    // Nggak ada closeDate eksplisit -- default aman: pendaftaran otomatis
    // ketutup begitu tanggal ACARANYA SENDIRI udah lewat. Tanpa ini, batch
    // yang lupa ditutup manual abis acaranya jalan bakal nyangkut terus
    // dianggap "buka" selamanya -- muncul di Overview admin sebagai "sedang
    // buka" padahal udah lewat, DAN (lebih parah) tetep nawarin orang
    // daftar ke event yang udah kejadian di halaman publik.
    const event = new Date(m.eventDateIso + "T00:00:00");
    if (today > event) return false;
  }
  return true;
}

// Versi server dari isEarlyBird() (workshop-config.js) -- logic sama persis,
// minimal salah satu batas (tanggal/jumlah) harus diisi biar dianggap early bird.
export function isEarlyBirdActive(m: MergedBatch, count?: number): boolean {
  if (m.earlyBirdPrice == null) return false;
  if (!m.earlyBirdDueDateIso && m.earlyBirdMaxCount == null) return false;
  if (m.earlyBirdDueDateIso) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(m.earlyBirdDueDateIso + "T00:00:00");
    if (today > due) return false;
  }
  if (m.earlyBirdMaxCount != null && typeof count === "number" && count >= m.earlyBirdMaxCount) return false;
  return true;
}

// Versi server dari getCurrentPrice() (workshop-config.js).
export function currentPrice(m: MergedBatch, count?: number): number {
  return isEarlyBirdActive(m, count) ? (m.earlyBirdPrice as number) : m.normalPrice;
}

// "2026-07-11" (ISO) -> "11/07/2026" (DD/MM/YYYY) -- kebalikan idDateToIso,
// dipakai buat ngasih tanggal ke halaman publik dalam format yang dipahami
// formatDateIndo()/parseDate() punya workshop-config.js.
export function isoToIdDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
