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

/** Cek apakah masih dalam periode early bird */
function isEarlyBird(workshop) {
    if (!workshop.earlyBirdPrice || !workshop.earlyBirdDueDate) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = parseDate(workshop.earlyBirdDueDate);
    return dueDate && today <= dueDate;
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

/** Ambil harga aktif (early bird atau normal) */
function getCurrentPrice(workshop) {
    if (isEarlyBird(workshop)) return workshop.earlyBirdPrice;
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
        // GOOGLE_SCRIPT_URL dari env.js — kalau belum ke-load, tunggu sebentar (maks ~4 dtk)
        if (typeof GOOGLE_SCRIPT_URL === "undefined" || !GOOGLE_SCRIPT_URL) {
            if (tries++ < 40) { setTimeout(refreshLive, 100); return; }
            fail(); return;
        }
        var cb = "_wsCfgCb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
        var s;
        window[cb] = function (data) {
            try { applyLive(data); }
            finally { try { delete window[cb]; } catch (e) { } if (s && s.parentNode) s.parentNode.removeChild(s); }
        };
        s = document.createElement("script");
        s.src = GOOGLE_SCRIPT_URL + "?page=config&callback=" + cb + "&_=" + Date.now();
        s.onerror = function () { try { delete window[cb]; } catch (e) { } fail(); };
        (document.head || document.documentElement).appendChild(s);
        // Timeout: JSONP script tag kadang nggak trigger onerror kalau server hang.
        setTimeout(function () { fail(); }, 12000);
    }
    refreshLive();
})();
