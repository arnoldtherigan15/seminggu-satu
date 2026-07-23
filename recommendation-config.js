/**
 * ====================================================
 * RECOMMENDATION CONFIG — Seminggu Satu by Arnold
 * ====================================================
 *
 * Edit file ini untuk mengatur daftar alat & bahan
 * journaling yang direkomendasikan.
 *
 * FORMAT ITEM:
 *   id          → unik, huruf kecil, pakai dash (misal: "kamei-machine")
 *   title       → nama produk
 *   image       → path gambar relatif dari root project
 *   description → deskripsi singkat produk
 *   link        → link toko/pembelian (Shopee, dll)
 *   category    → kategori: "tools" | "material" | "paper"
 *
 * CARA TAMBAH ITEM BARU:
 *   1. Duplikat salah satu blok { ... } di bawah
 *   2. Isi semua field sesuai produk baru
 *   3. Simpan file — otomatis tampil di halaman rekomendasi
 *
 * ====================================================
 */

var RECOMMENDATIONS = [
    {
        id: "kamei-machine",
        title: "Kamei — Die Cut & Emboss",
        image: "images/reccomendation/kamei.webp",
        description: "Alat untuk die cut dan emboss. Untuk cetakan kalian bisa cari di toko ini dengan keyword: <strong>\"Metal Dies\"</strong>, untuk emboss bisa di cari dengan keyword: <strong>\"Emboss Folder\"</strong>",
        link: "https://shopee.co.id/FREE-Dies-~-Foldable-Mini-Standard-Cutting-Embossing-Machine-KAMEI-seperti-Sizzix-i.321284763.12416373987",
        category: "tools"
    },
    {
        id: "corner-puncher",
        title: "Corner Puncher",
        image: "images/reccomendation/corner-puncher.webp",
        description: "Alat pemotong sudut kertas dengan 3 ukuran. Bikin sudut kartu atau kertas journaling jadi lebih rapi dan estetik.",
        link: "https://shopee.co.id/SUN-STAR-Kadomaru-Pro-Corner-Cutter-Puncher-Rounder-SunStar-i.16177589.22864567802",
        category: "tools"
    },
    {
        id: "puncher-1",
        title: "Puncher — Toko 1",
        image: "images/reccomendation/puncher-1.webp",
        description: "Salah satu toko favorit aku beli puncher. Tersedia berbagai bentuk decorative hole punch untuk scrapbooking, memory book, dan card making.",
        link: "https://shopee.co.id/Paper-Puncher-Decorative-Hole-Punching-Tool-Paper-Embossing-Tool-for-Scrapbooking-Memory-Book-Invitations-Card-Making-i.1396700432.46104303589",
        category: "tools"
    },
    {
        id: "puncher-2",
        title: "Puncher — Toko 2",
        image: "images/reccomendation/puncher-2.webp",
        description: "Tempat aku beli puncher sudut. Cocok untuk DIY scrapbook dan craft journaling. Tersedia berbagai motif yang bisa bikin karyamu makin cantik.",
        link: "https://shopee.co.id/DIY-Scrapbook-Corner-Punch-Children-Art-Paper-Craft-Tool-Puncher-Pembolong-Sudut-i.28258094.8100308151",
        category: "tools"
    },
    {
        id: "kertas-jasmine",
        title: "Kertas Jasmine",
        image: "images/reccomendation/jasmine.webp",
        description: "Kertas jasmine ukuran A6 (10,5×14,8 cm) 200gsm. Tekstur glitter yang cantik, cocok untuk cover journal, undangan, kartu nama, dan sertifikat.",
        link: "https://shopee.co.id/(-CUCI-GUDANG-!!!)-A6-Kertas-Jasmine-Glitter-Kertas-Jasmin-Paper-Flower-Undangan-Kartu-Nama-Sertifikat-i.238276032.14269352330",
        category: "paper"
    },
    {
        id: "kertas-hvs",
        title: "Kertas hvs berwarna",
        image: "images/reccomendation/hvs.webp",
        description: "Kertas HVS 70gsm warna-warni",
        link: "https://shopee.co.id/Kertas-HVS-Warna-Cerah-Pastel-Multifungsi-A4-70-GSM-N1073-i.22213145.20341873023",
        category: "paper"
    },
    {
        id: "puncher-3",
        title: "Puncher — Toko 3",
        image: "images/reccomendation/puncher-3.webp",
        description: "Tempat aku beli puncher sudut. Cocok untuk DIY scrapbook dan craft journaling. Tersedia berbagai motif yang bisa bikin karyamu makin cantik.",
        link: "https://shopee.co.id/pembolong-fancy-bentuk-no-1-lucu-ukuran-3-8-inch-kecil-baru-masuk-bunga-september-2025-i.40221307.5044921463",
        category: "tools"
    },
    {
        id: "paper-klip",
        title: "Puncher — Toko 3",
        image: "images/reccomendation/paper-clip.webp",
        description: "Paper clip dengan warna bagus",
        link: "https://shopee.co.id/HighTide-Penco-Clampy-Glitter-Plastic-Clip-Penjepit-Dokumen-Klip-Plastik-Gliter-Shiny-Document-Clip-i.16606759.57905002387",
        category: "tools"
    },
    {
        id: "curved-min-scissor",
        title: "Curved Mini Scissor",
        image: "images/reccomendation/curved-min-scissor.webp",
        description: "Gunting mini berbahan stainless steel  cocok untuk gunting detail",
        link: "https://shopee.co.id/Haquhara-Curved-Mini-Scissor-Gunting-Lengkung-Makeup-i.8076053.2862548103",
        category: "tools"
    },
    {
        id: "gunting-canary",
        title: "CANARY DSB-100 - Gunting anti sticky",
        image: "images/reccomendation/gunting-canary.webp",
        description: "Gunting kecil super tajam, Lapisan fluorin di bagian belakang mata pisau mencegah selotip dan zat lain menempel",
        link: "https://shopee.co.id/CANARY-DSB-100-Gunting-Desain-Ultra-Halus-Small-Scissors-Fluorinecorted-i.29904204.22228858030",
        category: "tools"
    },
    {
        id: "gunting-besar-non-sticky",
        title: "Gunting titanium anti sticky",
        image: "images/reccomendation/gunting-besar-non-sticky.webp",
        description: "Gunting besar super tajam, Lapisan fluorin di bagian belakang mata pisau mencegah selotip dan zat lain menempel",
        link: "https://shopee.co.id/PLUS-Gunting-titanium-coating-i.79188535.22113198626",
        category: "tools"
    },
    {
        id: "awl",
        title: "Awl - Book binding tool",
        image: "images/reccomendation/awl.webp",
        description: "Alat untuk melubangi kertas",
        link: "https://shopee.co.id/Leather-Tool-Stitching-Awl-Alat-Tusukan-Pembolong-3mm-Tusukan-kain-E1595-i.382915809.25914203441",
        category: "tools"
    },
    {
        id: "kokuyo-dotliner-glue",
        title: "Kokuyo Dotliner Glue Stamp",
        image: "images/reccomendation/kokuyo-dotliner-glue.webp",
        description: "Alat untuk melubangi kertas",
        link: "https://shopee.co.id/Kokuyo-Dotliner-Glue-Stamp-Lem-Tape-Double-Dobel-Isolasi-i.6092587.24458068647",
        category: "tools"
    },
    {
        id: "embossing-folder-1",
        title: "Embossing folder",
        image: "images/reccomendation/embossing-folder-1.webp",
        description: "Ini toko buat cari embossing folder atau metal dies",
        link: "https://shopee.co.id/Hollow-Heart-Plastic-Embossing-Folder-i.52961772.15836536562",
        category: "tools"
    },
    {
        id: "paper-trimmer",
        title: "Embossing folder",
        image: "images/reccomendation/paper-trimmer.webp",
        description: "Alat untuk memotong kertas",
        link: "https://shopee.co.id/Alat-Potong-Kertas-Paper-Cutter-SUN-JOURNEY-KM-5646-5669-5692-A4-Alat-Potong-Mesin-Pemotong-Kertas-HVS-Sticker-Art-Paper-Cocok-Untuk-DIY-Perlengkapan-Kantor-Perlengkapan-Sekolah-ATK-i.19826898.41318072453",
        category: "tools"
    },
    {
        id: "deco-paper",
        title: "[INFINITYSTUFF] Scrapbook background deco paper",
        image: "images/reccomendation/deco-paper.webp",
        description: "Tempat aku beli deco paper berbagai ukuran",
        link: "https://shopee.co.id/-INFINITYSTUFF-Scrapbook-background-deco-paper-tema-flower-colorful-gingham-1-set-isi-12-i.162371882.51304728331",
        category: "paper"
    },
    {
        id: "lem-astero",
        title: "Lem Astero Serbaguna",
        image: "images/reccomendation/lem-astero.webp",
        description: "Lem serbaguna untuk journaling, bisa untuk nempelin kain juga kayak bordir patch",
        link: "https://shopee.co.id/LEM-ASTERO-lem-serbaguna-lem-Glitter-i.143143674.24336397678",
        category: "paper"
    }
];

// ============================================================
//  CATEGORY LABELS — Ubah label tampilan kategori di sini
// ============================================================
const RECOMMENDATION_CATEGORIES = {
    "tools": "🛠️ Tools",
    "material": "🎨 Materials",
    "paper": "📄 Paper"
};

// ============================================================
//  KONTEN LIVE (mode "cached") — Fase 4
//  Sinkron: pakai cache localStorage kalau ada. Background: refresh dari server
//  untuk load berikutnya. Fallback ke data statis di atas kalau kosong/gagal.
// ============================================================
(function () {
    var CACHE_KEY = "ss_recommendation_cache";
    try {
        var cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length) RECOMMENDATIONS = parsed;
        }
    } catch (e) { /* pakai statis */ }

    function refreshCache() {
        if (typeof GOOGLE_SCRIPT_URL === "undefined" || !GOOGLE_SCRIPT_URL) return;
        var cbName = "_recommendationCb_" + Date.now();
        var s;
        window[cbName] = function (data) {
            try {
                if (Array.isArray(data) && data.length) localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            } catch (e) {}
            try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
            if (s && s.parentNode) s.parentNode.removeChild(s);
        };
        s = document.createElement("script");
        s.src = GOOGLE_SCRIPT_URL + "?page=content&type=recommendation&callback=" + cbName;
        s.onerror = function () { try { delete window[cbName]; } catch (e) {} };
        document.body.appendChild(s);
    }
    if (document.readyState === "complete") refreshCache();
    else window.addEventListener("load", refreshCache);
})();
