/**
 * ====================================================
 * WORKSHOP CONFIGURATION — Seminggu Satu by Arnold
 * ====================================================
 *
 * Edit file ini untuk mengatur pendaftaran workshop.
 *
 * FORMAT TANGGAL: DD/MM/YYYY
 *   Contoh: "05/04/2026" = 5 April 2026
 *
 * CARA PAKAI:
 *   1. enabled  → true = buka, false = tutup manual
 *   2. openDate → tanggal mulai pendaftaran
 *   3. closeDate → tanggal tutup pendaftaran
 *   4. earlyBirdDueDate → batas harga early bird,
 *      setelah tanggal ini otomatis pakai harga normal
 *   5. earlyBirdMaxCount (opsional) → early bird cuma buat N pendaftar
 *      pertama, walau tanggalnya belum lewat (kosong = tanpa batas jumlah)
 *
 * ====================================================
 */

// ============================================================
//  SUMBER TUNGGAL = SERVER. Config workshop HANYA diedit dari
//  dashboard admin (tab Config), disimpan di server, disajikan via
//  ?page=config. TIDAK ADA data statis lagi di file ini biar nggak
//  pernah ada "dua versi" yang bikin data basi.
//
//  Alur di halaman publik:
//    1) Kalau ada cache localStorage (data server terakhir) -> paint instan.
//    2) Selalu ambil config TERBARU dari server -> timpa + re-render.
//    3) Belum ada config sama sekali -> tampil shimmer/loading.
//    4) Gagal & nggak ada cache -> tampil error.
// ============================================================
// 'var' supaya bisa ditimpa cache/server. Default KOSONG (bukan data statis).
var WORKSHOPS = [];

// Status pengambilan config: "pending" | "live" | "failed"
// (dibaca halaman buat nentuin shimmer vs error vs render).
window.WS_CONFIG_STATE = "pending";

// ============================================================
//  HELPER FUNCTIONS — Jangan diubah kecuali kamu tahu caranya
// ============================================================

/** Parse "DD/MM/YYYY" → Date object */
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts;
    return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
}

/**
 * Cek status workshop:
 *   "open"         — bisa diakses
 *   "disabled"     — ditutup manual (enabled: false)
 *   "not-open-yet" — belum sampai openDate
 *   "closed"       — sudah lewat closeDate
 */
function getWorkshopStatus(workshop) {
    if (!workshop || !workshop.enabled) return "disabled";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (workshop.openDate) {
        const openDate = parseDate(workshop.openDate);
        if (openDate && today < openDate) return "not-open-yet";
    }

    if (workshop.closeDate) {
        const closeDate = parseDate(workshop.closeDate);
        if (closeDate && today > closeDate) return "closed";
    }

    return "open";
}

/**
 * Cek apakah masih dalam periode early bird. Dua batas independen, boleh
 * pakai salah satu atau dua-duanya (kalau dua-duanya diisi, early bird
 * berhenti begitu SALAH SATU kelewatan):
 *   - earlyBirdDueDate  -> batas tanggal
 *   - earlyBirdMaxCount -> batas jumlah pendaftar pertama (butuh `count`,
 *     dari workshop-counts; kalau count nggak dikasih tau, batas ini
 *     dilewatin -- caller lama yang cuma pakai tanggal tetep jalan normal)
 * Minimal salah satu batas harus diisi, kalau nggak ada dua-duanya berarti
 * "harga early bird" nggak ada gunanya (bakal selamanya aktif) -> dianggap
 * bukan early bird.
 */
function isEarlyBird(workshop, count) {
    if (!workshop.earlyBirdPrice) return false;
    if (!workshop.earlyBirdDueDate && !workshop.earlyBirdMaxCount) return false;
    if (workshop.earlyBirdDueDate) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = parseDate(workshop.earlyBirdDueDate);
        if (!dueDate || today > dueDate) return false;
    }
    if (workshop.earlyBirdMaxCount && typeof count === "number" && count >= workshop.earlyBirdMaxCount) return false;
    return true;
}

/** Ambil workshop berdasarkan ID */
function getWorkshopById(id) {
    return WORKSHOPS.find(w => w.id === id) || null;
}

/** Format angka ke Rupiah: 325000 → "Rp 325.000" */
function formatRupiah(num) {
    if (!num || num <= 0) return "TBA";
    return "Rp " + num.toLocaleString("id-ID");
}

/** Ambil harga aktif (early bird atau normal). `count` opsional, lihat isEarlyBird(). */
function getCurrentPrice(workshop, count) {
    if (isEarlyBird(workshop, count)) return workshop.earlyBirdPrice;
    return workshop.normalPrice;
}

/** Format tanggal DD/MM/YYYY → "5 April 2026" */
function formatDateIndo(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return "-";
    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================================
//  CONFIG LIVE (mode "cached") — Fase 3
//  1) SINKRON: pakai config dari cache localStorage kalau ada (render instan).
//  2) BACKGROUND: setelah halaman load, ambil config terbaru dari server &
//     simpan ke cache untuk load BERIKUTNYA. Tidak menambah delay render.
//  Kalau server tak terjangkau / cache kosong, WORKSHOPS statis di atas tetap dipakai.
// ============================================================
(function () {
    var CACHE_KEY = "ss_workshops_cache";
    var settled = false;   // sudah dapat hasil (sukses/gagal final)?

    // 1) Paint instan dari cache terakhir (data server terakhir yg diketahui).
    try {
        var cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length) WORKSHOPS = parsed;
        }
    } catch (e) { /* cache rusak -> biarin kosong, tunggu live */ }

    // 2) SELALU ambil config TERBARU dari server, lalu TIMPA + re-render.
    //    Begitu config server datang, halaman langsung update (event "workshops:updated").
    function applyLive(data) {
        if (!Array.isArray(data) || !data.length) { fail(); return; }
        settled = true;
        WORKSHOPS = data;
        window.WS_CONFIG_STATE = "live";
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { }
        try { window.dispatchEvent(new CustomEvent("workshops:updated")); } catch (e) { }
    }

    function fail() {
        if (settled) return;
        settled = true;
        // Kalau ada cache, pakai itu (last-known-good) & anggap "live" biar nggak error.
        window.WS_CONFIG_STATE = (WORKSHOPS && WORKSHOPS.length) ? "live" : "failed";
        try { window.dispatchEvent(new CustomEvent(WORKSHOPS && WORKSHOPS.length ? "workshops:updated" : "workshops:failed")); } catch (e) { }
    }

    var tries = 0;
    function refreshLive() {
        // SUPABASE_URL dari env.js — kalau belum ke-load, tunggu sebentar (maks ~4 dtk)
        if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) {
            if (tries++ < 40) { setTimeout(refreshLive, 100); return; }
            fail(); return;
        }
        // Timeout: kalau server hang, tetep gagal setelah 12 dtk.
        var timer = setTimeout(function () { fail(); }, 12000);
        fetch(SUPABASE_URL + "/rest/v1/app_config?key=eq.WORKSHOPS_JSON&select=value", {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY }
        })
            .then(function (res) { return res.json(); })
            .then(function (rows) {
                clearTimeout(timer);
                var raw = rows && rows[0] && rows[0].value;
                var data = null;
                try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
                applyLive(data);
            })
            .catch(function () { clearTimeout(timer); fail(); });
    }
    refreshLive();
})();
