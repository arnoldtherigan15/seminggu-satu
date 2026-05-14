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

const RECOMMENDATIONS = [
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
    }
];

// ============================================================
//  CATEGORY LABELS — Ubah label tampilan kategori di sini
// ============================================================
const RECOMMENDATION_CATEGORIES = {
    "tools": "🛠️ Alat",
    "material": "🎨 Bahan",
    "paper": "📄 Kertas"
};
