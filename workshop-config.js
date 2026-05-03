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

const WORKSHOPS = [
    {
        id: "bookmark-journal",
        name: "Pull & Pop: A Journaling Bookmark",
        description: "Buat bookmark interaktifmu sendiri dengan mekanisme pull & pop! Pilih pita dan rantai favoritmu.",
        icon: "bookmark",
        path: "bookmark-journal/index.html",
        enabled: true,
        openDate: "03/05/2026",
        closeDate: "26/05/2026",
        normalPrice: 175000,
        earlyBirdPrice: null,
        earlyBirdDueDate: null,
        maxQuota: 9,
        workshopDate: "Rabu, 27 Mei 2026",
        workshopTime: "15:00 - 17:30 WIB",
        locationName: "Kopi Aloo Melawai",
        mapsLink: "https://maps.app.goo.gl/6T7QmqryfE7ATbkz5",
        isDisplay: true,
        whatsappGroupLink: "https://chat.whatsapp.com/Ba3DC7JFQSt1u1tgIMATw9?mode=gi_t"
    },
    {
        id: "3d-frame-journaling",
        name: "3D Layered Journaling",
        description: "Frame, Texture & Motion",
        icon: "frame",
        path: "3d-frame-journaling/index.html",
        enabled: true,
        openDate: "04/04/2026",
        closeDate: "24/04/2026",
        normalPrice: 188000,
        earlyBirdPrice: 169000,
        earlyBirdDueDate: "12/04/2026",
        maxQuota: 12,
        workshopDate: "Sabtu, 25 April 2026",
        workshopTime: "15:00 - 17:30 WIB",
        locationName: "Melting Pot, GF at ASHTA District 8",
        mapsLink: "https://maps.app.goo.gl/aanUWLu5we3VvQqg6",
        isDisplay: false,
    },
    {
        id: "paper-journal",
        name: "Paper Journal Creative Workshop",
        description: "Buat paper journal versimu yang unik dari kertas spesial. Pilih perpaduan warna favoritmu!",
        icon: "book-open",
        path: "paper-journal/index.html",
        enabled: true,
        openDate: "12/04/2026",
        closeDate: "13/04/2026",
        normalPrice: 255000,
        earlyBirdPrice: 344000,
        earlyBirdDueDate: "10/04/2026",
        maxQuota: 1,
        workshopDate: "Minggu, 17 Mei 2026",
        workshopTime: "15:00 - 17:30 WIB",
        locationName: "Melting Pot, GF at ASHTA District 8",
        mapsLink: "https://maps.app.goo.gl/aanUWLu5we3VvQqg6",
        isDisplay: false,
    },
    {
        id: "upcycle-journal",
        name: "Upcycle Bag Journal Workshop",
        description: "Recycle shopping bag into a unique journal cover. Limited stock for each bag!",
        icon: "shopping-bag",
        path: "upcycle-journal/index.html",
        enabled: true,
        openDate: "12/04/2026",
        closeDate: "16/05/2026",
        normalPrice: 382000,
        earlyBirdPrice: 344000,
        earlyBirdDueDate: "20/04/2026",
        maxQuota: 12,
        workshopDate: "Minggu, 17 Mei 2026",
        workshopTime: "15:00 - 17:30 WIB",
        locationName: "Melting Pot, GF at ASHTA District 8",
        mapsLink: "https://maps.app.goo.gl/aanUWLu5we3VvQqg6",
        isDisplay: true,
        whatsappGroupLink: ""
    }
];

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
