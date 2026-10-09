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

    // ============================================================
    //  IN-APP BROWSER WARNING -- link workshop sering dibagi lewat
    //  Instagram/Threads/Facebook/TikTok, yang bukanya pake webview
    //  internal app (bukan Chrome/Safari beneran). Webview-webview ini
    //  punya file-picker/FileReader yang dibatasi/rusak -- upload foto
    //  (bukti bayar, dst) sering gagal total dengan error generik "Gagal
    //  membaca file gambar" walau fotonya normal & di browser asli lancar
    //  (BUG NYATA yang dilaporin Arnold: pendaftar daftar dari link yang
    //  dibagi di Threads, upload gambar selalu gagal, padahal kalau
    //  dibuka manual di Chrome/Safari lancar). Nggak ada cara 100% aman
    //  buat "ngeluarin" user dari webview-webview ini lewat kode -- yang
    //  bisa dilakuin cuma: 1) kasih tau mereka lagi kena situasi ini (gak
    //  kelihatan dari UI appnya sendiri), 2) di Android sediain tombol
    //  yang nyoba maksa buka Chrome (intent:// URL scheme, cukup
    //  reliable), 3) di iOS webview nggak bisa di-redirect paksa lewat
    //  JS (dibatasi sandbox-nya) jadi cuma kasih instruksi manual.
    (function inAppBrowserWarning() {
        // Admin dashboard dipakenya Arnold sendiri dari desktop -- banner
        // ini nggak relevan di situ, cuma bakal jadi noise.
        if (location.pathname.indexOf("/admin/") !== -1) return;
        try { if (sessionStorage.getItem("ss_inapp_banner_dismissed") === "1") return; } catch (e) { }

        var ua = navigator.userAgent || navigator.vendor || "";
        var isAndroid = /Android/i.test(ua);
        var isIOS = /iPhone|iPad|iPod/i.test(ua);
        var appName = null;
        // Token UA per app -- Threads kadang nggak kasih token unik (ikut
        // mesin webview Instagram), tapi di sebagian versi Android/iOS
        // muncul "Threads"/"Barcelona" (nama kode internal Threads).
        if (/Instagram/i.test(ua)) appName = "Instagram";
        else if (/FBAN|FBAV|FB_IAB/i.test(ua)) appName = "Facebook";
        else if (/Threads|Barcelona/i.test(ua)) appName = "Threads";
        else if (/TikTok|musical_ly|Bytedance/i.test(ua)) appName = "TikTok";
        else if (/Line\//i.test(ua)) appName = "LINE";
        else if (/MicroMessenger/i.test(ua)) appName = "WeChat";
        else if (/Twitter/i.test(ua)) appName = "X/Twitter";
        if (!appName || (!isAndroid && !isIOS)) return; // nggak kedetek / bukan mobile -> jangan ganggu

        function dismiss() {
            var el = document.getElementById("ssInAppWarn");
            if (el) el.remove();
            try { sessionStorage.setItem("ss_inapp_banner_dismissed", "1"); } catch (e) { }
        }

        function openInRealBrowser() {
            if (!isAndroid) return; // iOS webview nggak bisa di-redirect paksa lewat JS
            var withoutScheme = location.href.replace(/^https?:\/\//, "");
            location.href = "intent://" + withoutScheme + "#Intent;scheme=https;package=com.android.chrome;end;";
        }

        function render() {
            var bar = document.createElement("div");
            bar.id = "ssInAppWarn";
            bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
                "background:#fff3cd;color:#7a4a00;border-bottom:2px solid #ffe066;" +
                "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
                "font-size:13.5px;line-height:1.4;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top));" +
                "display:flex;align-items:center;gap:10px;box-shadow:0 2px 10px rgba(0,0,0,.08);";

            var msg = document.createElement("div");
            msg.style.cssText = "flex:1;";
            msg.innerHTML = "⚠️ <b>Lagi buka lewat " + appName + "</b> -- upload foto sering gagal di sini. " +
                (isAndroid
                    ? "Ketuk tombol di samping buat buka di browser biar lancar ya."
                    : "Ketuk titik tiga (⋯) di pojok kanan atas, lalu pilih <b>\"Buka di Safari\"</b>/<b>\"Open in Browser\"</b> ya.");

            var actions = document.createElement("div");
            actions.style.cssText = "display:flex;align-items:center;gap:6px;flex-shrink:0;";

            if (isAndroid) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = "Buka di Browser";
                btn.style.cssText = "background:#7a4a00;color:#fff;border:none;border-radius:8px;" +
                    "padding:8px 12px;font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer;";
                btn.addEventListener("click", openInRealBrowser);
                actions.appendChild(btn);
            }

            var closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.setAttribute("aria-label", "Tutup");
            closeBtn.textContent = "✕";
            closeBtn.style.cssText = "background:transparent;border:none;color:#7a4a00;" +
                "font-size:15px;line-height:1;cursor:pointer;padding:6px;flex-shrink:0;";
            closeBtn.addEventListener("click", dismiss);
            actions.appendChild(closeBtn);

            bar.appendChild(msg);
            bar.appendChild(actions);
            document.body.appendChild(bar);
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", render);
        } else {
            render();
        }
    })();

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
