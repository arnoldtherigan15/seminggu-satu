// "Catat cepat": 1 kalimat bebas -> transaksi. Dipakai bareng sama kolom
// Catat cepat di admin (personal-api) dan bot Telegram, biar hasilnya sama.
//   "kopi 25rb"                     -> pengeluaran 25.000, Makan & Minum, akun default, hari ini
//   "grab 32k gopay kemarin"        -> Transport, akun GoPay, kemarin
//   "gaji 8,5jt masuk bca"          -> pemasukan, Gaji, BCA
//   "tf 500rb bca ke gopay"         -> transfer BCA -> GoPay
// Kategori: (1) belajar dari riwayat -- catatan yang mirip pernah masuk
// kategori apa, (2) kamus kata kunci, (3) "Lainnya".

export type QAccount = { id: string; name: string; type?: string; archived?: boolean };
export type QCategory = { id: string; name: string; type: string; archived?: boolean };
export type QHistory = { note: string | null; category_id: string | null; account_id: string; type: string };
export type QParsed = {
  ok: boolean; error?: string;
  type: "income" | "expense" | "transfer"; amount: number; date: string;
  accountId: string | null; toAccountId: string | null; categoryId: string | null;
  note: string; guessed: { account: boolean; category: "history" | "keyword" | "fallback" | "none"; date: boolean };
};

const WIB = 7 * 3600 * 1000;
export function todayWib(now = Date.now()): string { return new Date(now + WIB).toISOString().slice(0, 10); }
function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// alias umum nama akun -> dicocokin ke nama akun yang ada
const ACCOUNT_ALIASES: Record<string, string[]> = {
  gopay: ["gopay", "go pay", "gojek pay"], ovo: ["ovo"], dana: ["dana"],
  shopeepay: ["shopeepay", "shopee pay", "spay", "shopee"], cash: ["cash", "tunai", "dompet", "kas"],
  bca: ["bca", "blu", "blu bca"], mandiri: ["mandiri", "livin"], bni: ["bni"], bri: ["bri", "brimo"], jago: ["jago"], seabank: ["seabank", "sea bank"],
};
// kamus kata kunci -> kata di nama kategori (dicari case-insensitive)
const CATEGORY_WORDS: [string, string[]][] = [
  ["makan", ["kopi", "coffee", "kopken", "starbucks", "janji jiwa", "fore", "makan", "minum", "nasi", "ayam", "bakso", "mie", "mi ayam", "sate", "soto", "warteg", "jajan", "snack", "cemilan", "gofood", "grabfood", "shopeefood", "boba", "teh", "roti", "sarapan", "lunch", "dinner", "makan siang", "makan malam", "resto", "cafe", "kafe", "mcd", "kfc", "pizza", "martabak", "indomie", "galon", "air"]],
  ["transport", ["grab", "gojek", "gocar", "goride", "ojol", "ojek", "taksi", "taxi", "bluebird", "bensin", "pertalite", "pertamax", "parkir", "tol", "krl", "mrt", "lrt", "transjakarta", "tj", "kereta", "busway", "bus", "pesawat", "tiket kereta", "maxim", "uber"]],
  ["tagihan", ["listrik", "pln", "token", "pulsa", "kuota", "paket data", "internet", "wifi", "indihome", "biznet", "netflix", "spotify", "youtube premium", "icloud", "google one", "chatgpt", "claude", "langganan", "bpjs", "pdam", "air pam", "cicilan", "kos", "kost", "sewa"]],
  ["belanja", ["belanja", "shopee", "tokped", "tokopedia", "lazada", "tiktok shop", "indomaret", "alfamart", "alfamidi", "superindo", "supermarket", "pasar", "baju", "sepatu", "skincare", "sabun", "shampo", "kertas", "alat tulis", "atk", "ikea"]],
  ["hiburan", ["nonton", "bioskop", "cgv", "xxi", "konser", "game", "steam", "karaoke", "liburan", "staycation", "hotel", "museum", "tiket"]],
  ["kesehatan", ["obat", "dokter", "apotek", "apotik", "klinik", "rumah sakit", "rs", "vitamin", "gym", "check up", "lab"]],
  ["gaji", ["gaji", "salary", "payroll", "honor", "fee"]],
  ["bonus", ["bonus", "thr", "insentif", "komisi"]],
];
const INCOME_WORDS = ["gaji", "salary", "bonus", "thr", "masuk", "terima", "diterima", "dapet", "dapat", "refund", "cashback", "dibayar", "pemasukan", "honor", "fee", "komisi", "jual", "hasil jual", "untung"];
const TRANSFER_WORDS = ["transfer", "tf", "pindah", "topup", "top up", "isi saldo", "tarik tunai", "tarik"];

// "25rb" "25 ribu" "25k" "1,5jt" "2 juta" "25.000" "Rp 25.000" "25000"
const AMOUNT_RE = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|m|million)?\b/i;
function parseAmount(text: string): { value: number; match: string } | null {
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1], unit = (m[2] || "").toLowerCase();
    // angka tanggal ("12/11") / jam ("13.30") tanpa satuan bukan nominal
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 1);
    const before = text.slice(Math.max(0, m.index - 1), m.index);
    if (!unit && (after === "/" || before === "/")) continue;
    let n: number;
    if (unit) n = Number(raw.replace(",", ".").replace(/\.(?=\d{3}\b)/g, ""));
    else n = Number(raw.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
    if (!isFinite(n) || n <= 0) continue;
    if (unit === "rb" || unit === "ribu" || unit === "k") n *= 1000;
    else if (unit === "jt" || unit === "juta" || unit === "m" || unit === "million") n *= 1_000_000;
    else if (n < 100 && !/rp/i.test(m[0])) continue; // "2 kopi" -> bukan nominal
    return { value: Math.round(n), match: m[0] };
  }
  return null;
}
const DAYS_ID = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const MONTHS_ID = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"];
function parseDate(text: string, today: string): { date: string; match: string } | null {
  const t = text.toLowerCase();
  let m = /\b(hari ini|tadi|barusan|td)\b/.exec(t); if (m) return { date: today, match: m[0] };
  m = /\b(kemarin|kmrn|kemaren)\b/.exec(t); if (m) return { date: addDays(today, -1), match: m[0] };
  m = /\b(lusa kemarin|kemarin lusa)\b/.exec(t); if (m) return { date: addDays(today, -2), match: m[0] };
  m = /\b(\d{1,2}) hari (lalu|yang lalu|yg lalu)\b/.exec(t); if (m) return { date: addDays(today, -Number(m[1])), match: m[0] };
  m = new RegExp(`\\b(${DAYS_ID.join("|")})( kemarin| lalu)?\\b`).exec(t);
  if (m) { // hari terakhir yang namanya itu (bukan hari ini)
    const target = DAYS_ID.indexOf(m[1]);
    const dow = new Date(today + "T00:00:00Z").getUTCDay();
    let back = (dow - target + 7) % 7; if (back === 0) back = 7;
    return { date: addDays(today, -back), match: m[0] };
  }
  m = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(t);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
    const d = `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    if (!isNaN(Date.parse(d)) && d <= today) return { date: d, match: m[0] };
  }
  m = new RegExp(`\\b(\\d{1,2}) (${MONTHS_ID.join("|")})[a-z]*\\b`).exec(t);
  if (m) {
    let y = Number(today.slice(0, 4));
    let d = `${y}-${String(MONTHS_ID.indexOf(m[2]) + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    if (d > today) { y--; d = `${y}` + d.slice(4); }
    return { date: d, match: m[0] };
  }
  return null;
}
function findAccounts(text: string, accounts: QAccount[]): { id: string; at: number; match: string }[] {
  const t = " " + text.toLowerCase() + " ";
  const hits: { id: string; at: number; match: string }[] = [];
  for (const a of accounts) {
    const name = a.name.toLowerCase();
    const keys = new Set([name, name.replace(/\s+/g, "")]);
    for (const [k, al] of Object.entries(ACCOUNT_ALIASES)) if (name.replace(/\s+/g, "").includes(k) || al.some((x) => name.includes(x))) al.forEach((x) => keys.add(x));
    let best: { at: number; match: string } | null = null;
    for (const k of keys) {
      const re = new RegExp(`[^a-z0-9]${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`);
      const m = re.exec(t);
      if (m && (!best || k.length > best.match.length)) best = { at: m.index, match: k };
    }
    if (best) hits.push({ id: a.id, ...best });
  }
  return hits.sort((x, y) => x.at - y.at);
}

export function parseQuickTx(textIn: string, ctx: { accounts: QAccount[]; categories: QCategory[]; history: QHistory[]; today?: string }): QParsed {
  const text = String(textIn || "").trim();
  const today = ctx.today || todayWib();
  const accounts = ctx.accounts.filter((a) => !a.archived);
  const cats = ctx.categories.filter((c) => !c.archived);
  const empty: QParsed = { ok: false, type: "expense", amount: 0, date: today, accountId: null, toAccountId: null, categoryId: null, note: "", guessed: { account: true, category: "none", date: true } };
  if (!text) return { ...empty, error: "Ketik dulu, mis. \"kopi 25rb\"." };

  const amt = parseAmount(text);
  if (!amt) return { ...empty, error: "Nominalnya belum kebaca. Coba tulis mis. 25rb, 25k, atau 25.000." };
  const dt = parseDate(text, today);
  const lower = " " + norm(text) + " ";
  const has = (w: string) => lower.includes(" " + w + " ");

  const accHits = findAccounts(text, accounts);
  let type: QParsed["type"] = "expense";
  if (/^\s*\+/.test(text) || INCOME_WORDS.some(has)) type = "income";
  if (accHits.length >= 2 && (TRANSFER_WORDS.some(has) || / ke /.test(lower))) type = "transfer";
  else if (TRANSFER_WORDS.some(has) && accHits.length >= 1 && / ke /.test(lower)) type = "transfer";

  // akun: yang disebut; kalau nggak ada -> akun yang paling sering dipakai buat tipe ini
  let accountId: string | null = null, toAccountId: string | null = null, accGuess = false;
  if (type === "transfer") {
    // "dari X ke Y" / "X ke Y": yang setelah "ke" = tujuan
    const keIdx = lower.indexOf(" ke ");
    const after = accHits.filter((h) => h.at >= keIdx - 1), before = accHits.filter((h) => h.at < keIdx - 1);
    toAccountId = (after[0] || accHits[1] || accHits[0]).id;
    accountId = (before[0] || accHits.find((h) => h.id !== toAccountId) || { id: null } as unknown as typeof accHits[0]).id;
    if (!accountId || accountId === toAccountId) {
      accGuess = true;
      accountId = mostUsedAccount(ctx.history, accounts, type, toAccountId);
    }
  } else if (accHits.length) accountId = accHits[0].id;
  else { accountId = mostUsedAccount(ctx.history, accounts, type, null); accGuess = true; }

  // catatan = teks tanpa nominal/tanggal/akun/kata penghubung
  let note = text.replace(amt.match, " ");
  if (dt) note = note.replace(new RegExp(dt.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
  for (const h of accHits) note = note.replace(new RegExp(`(^|[^a-z0-9])${h.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i"), "$1 ");
  note = note.replace(/\b(pakai|pake|via|dari|ke|masuk|keluar|bayar|di|buat|untuk|utk)\b\s*$/gi, " ")
    .replace(/^\s*[+-]\s*/, "").replace(/\s+(pakai|pake|via|dari|ke)\s*$/i, "").replace(/\s+/g, " ").trim();
  note = note.replace(/\s+\b(pakai|pake|via|dari|ke|masuk)\b(\s+\b(pakai|pake|via|dari|ke|masuk)\b)*$/i, "").trim();
  if (type === "transfer" && (!note || TRANSFER_WORDS.includes(norm(note)))) note = /top ?up|isi saldo/i.test(text) ? "Top up" : /tarik/i.test(text) ? "Tarik tunai" : "Transfer";
  if (note) note = note.charAt(0).toUpperCase() + note.slice(1);

  // kategori
  let categoryId: string | null = null, catGuess: QParsed["guessed"]["category"] = "none";
  if (type !== "transfer") {
    const pool = cats.filter((c) => c.type === type);
    const words = norm(note).split(" ").filter((w) => w.length > 1);
    // (1) riwayat: catatan yang mirip (kata pertama / kalimat sama) paling sering di kategori apa
    if (words.length) {
      const score = new Map<string, number>();
      for (const h of ctx.history) {
        if (!h.category_id || h.type !== type || !h.note) continue;
        const hn = norm(h.note);
        let s = 0;
        if (hn === norm(note)) s = 5;
        else if (hn.split(" ")[0] === words[0]) s = 2;
        else if (words.some((w) => w.length > 3 && (" " + hn + " ").includes(" " + w + " "))) s = 1;
        if (s && pool.some((c) => c.id === h.category_id)) score.set(h.category_id, (score.get(h.category_id) || 0) + s);
      }
      const top = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 2) { categoryId = top[0]; catGuess = "history"; }
    }
    // (2) kamus kata kunci
    if (!categoryId) {
      const ln = " " + norm(text) + " ";
      for (const [catWord, keys] of CATEGORY_WORDS) {
        if (!keys.some((k) => ln.includes(" " + k + " "))) continue;
        const c = pool.find((x) => norm(x.name).includes(catWord));
        if (c) { categoryId = c.id; catGuess = "keyword"; break; }
      }
    }
    // (3) "Lainnya"
    if (!categoryId) {
      const c = pool.find((x) => /lain/i.test(x.name));
      if (c) { categoryId = c.id; catGuess = "fallback"; }
    }
  }
  if (!accountId) return { ...empty, amount: amt.value, error: "Belum ada akun. Bikin akun dulu di tab Akun." };
  return {
    ok: true, type, amount: amt.value, date: dt ? dt.date : today, accountId, toAccountId, categoryId,
    note: note || (type === "transfer" ? "Transfer" : ""), guessed: { account: accGuess, category: catGuess, date: !dt },
  };
}
function mostUsedAccount(history: QHistory[], accounts: QAccount[], type: string, exclude: string | null): string | null {
  const cnt = new Map<string, number>();
  for (const h of history.slice(0, 200)) if ((h.type === type || type === "transfer") && h.account_id !== exclude) cnt.set(h.account_id, (cnt.get(h.account_id) || 0) + 1);
  const ok = new Set(accounts.map((a) => a.id));
  const top = [...cnt.entries()].filter(([id]) => ok.has(id)).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : (accounts.find((a) => a.id !== exclude) || { id: null } as unknown as QAccount).id;
}

// ringkasan 1 baris buat balasan (Telegram / toast)
export function rp(n: number): string { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
