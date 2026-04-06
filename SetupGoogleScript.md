# Panduan Setup Database Gratis (Google Sheets & Google Drive)

Website sudah selesai dibuat! Namun, agar form pendaftaran bisa menyimpan data, kita perlu menghubungkannya ke ekosistem Google Anda menggunakan **Google Apps Script**. Tenang saja, ini 100% gratis. 

Ikuti panduan langkah demi langkah di bawah ini:

## Langkah 1: Siapkan Google Sheets
1. Buka [Google Sheets](https://sheets.google.com) dan buat Spreadsheet Kosong baru.
2. Beri nama file ini, misalnya: **"Data Pendaftaran Workshop Journal"**
3. Di **Baris ke-1**, ketikkan *header* (judul kolom) persis seperti ini (harus sama persis huruf besar/kecilnya):
   - Kolom A: `Timestamp`
   - Kolom B: `Nama Lengkap`
   - Kolom C: `Inisial`
   - Kolom D: `Front Cover Word`
   - Kolom E: `Warna Cover`
   - Kolom F: `Warna Flap`
   - Kolom G: `Warna Tali`
   - Kolom H: `Link Foto Charm`
   - Kolom I: `Link Bukti Bayar`
   - Kolom J: `Nomor WhatsApp`
   - Kolom K: `Username IG`
   - Kolom L: `Sesi Pilihan`
   - Kolom M: `Izin Dokumentasi`

## Langkah 2: Buat Folder Google Drive
1. Buka [Google Drive](https://drive.google.com).
2. Buat folder baru, beri nama **"Uploads Workshop Journal"**.
3. **PENTING:** Buka folder tersebut. Di atas, lihat URL/Link di *browser* Anda. Akan ada teks panjang setelah `folders/`. 
   *(Contoh: `https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsT_uvwxyz`)*. 
4. **Copy teks panjang/ID tersebut (`1aBcDeFgHiJkLm...`)**. Kita akan membutuhkannya di Langkah 3.

## Langkah 3: Memasang Kode Google Script
1. Kembali ke tab **Google Sheets** yang Anda buat di Langkah 1.
2. Klik menu **Ekstensi** > **Apps Script**. Tab baru akan terbuka.
3. Hapus semua kode yang ada di layar, lalu **Copy-Paste seluruh kode di blok bawah ini** ke dalamnya:

```javascript
/* ========================================================
   SCRIPT PENDAFTARAN WORKSHOP (V4: SUPPORT WHATSAPP & REORDER)
   ======================================================== */

// GANTI TEKS DI BAWAH INI DENGAN ID FOLDER DRIVE ANDA
const FOLDER_ID = "1fCvdScjmhYqC8dolqvzqCe7m22TTTg0K";

// BACA SISA SLOT PENDAFTARAN (MENGGUNAKAN JSONP UNTUK BYPASS CORS URL PARAMETER)
function doGet(e) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sh.getDataRange().getValues();
  
  let countSesi1 = 0; // "Sabtu, 28 March 2026"
  let countSesi2 = 0; // "Minggu, 29 March 2026"

  // Mulai hitung dari baris ke-2 (Baris 1 adalah Header)
  for (let i = 1; i < data.length; i++) {
    const sesiDb = data[i][11]; // Index ke-11 (Kolom L: Sesi)
    if (sesiDb === "Sabtu, 28 March 2026") countSesi1++;
    if (sesiDb === "Minggu, 29 March 2026") countSesi2++;
  }

  const result = { 
    "status": "success",
    "slotSesi1": 10 - countSesi1,
    "slotSesi2": 10 - countSesi2
  };

  // Mengembalikan sebagai JSONP jika ada callback, atau JSON biasa jika tidak ada.
  if (e.parameter.callback) {
    return ContentService.createTextOutput(e.parameter.callback + '(' + JSON.stringify(result) + ')')
                         .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(JSON.stringify(result))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    // 2. Simpan Foto Referensi Charm
    let charmUrl = "-";
    if (data.charmBase64) {
      const charmBlob = Utilities.newBlob(Utilities.base64Decode(data.charmBase64), data.charmMimeType, "Charm_" + data.fullName);
      const charmFile = folder.createFile(charmBlob);
      charmFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      charmUrl = charmFile.getUrl();
    }

    // 3. Simpan Bukti Pembayaran
    let paymentUrl = "-";
    if (data.paymentBase64) {
      const paymentBlob = Utilities.newBlob(Utilities.base64Decode(data.paymentBase64), data.paymentMimeType, "Bayar_" + data.fullName);
      const paymentFile = folder.createFile(paymentBlob);
      paymentFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      paymentUrl = paymentFile.getUrl();
    }

    /* 4. Masukkan data teks ke Baris baru di Google Sheets. 
       URUTAN KOLOM:
       A: Timestamp, B: Nama, C: Inisial, D: Front Cover Word,
       E: Warna Cover, F: Warna Flap, G: Warna Tali,
       H: Foto Charm, I: Bukti Bayar, J: WhatsApp, K: IG, L: Sesi, M: Izin Dokumentasi
    */
    sh.appendRow([
      new Date(),
      data.fullName,
      data.initial,
      data.frontCoverWord || "-",
      data.colorBody,
      data.colorFlap,
      data.colorStrap,
      charmUrl,
      paymentUrl,
      data.whatsapp || "-",           // Field Baru: Nomor WhatsApp
      data.igUsername,
      data.sessionSelected,
      data.consentCheck ? "Ya" : "Tidak"
    ]);

    // 5. Beri tahu website bahwa penyimpanan sukses
    return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// Dibutuhkan oleh Google untuk mengizinkan request
function doOptions(e) { 
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}
```

4. **JANGAN LUPA:** Ubah tulisan `"MASUKKAN_ID_FOLDER_DRIVE_DISINI"` dengan ID Folder (copy dari Langkah 2).

## Langkah 3b: Pastikan Header Kolom Google Sheets Anda Sudah Sesuai
Pastikan urutan *header* di Baris ke-1 Google Sheets Anda sekarang menjadi:
- Kolom A: `Timestamp`
- Kolom B: `Nama Lengkap`
- Kolom C: `Inisial`
- Kolom D: `Front Cover Word`
- Kolom E: `Warna Cover`
- Kolom F: `Warna Flap`
- Kolom G: `Warna Tali`
- Kolom H: `Link Foto Charm`
- Kolom I: `Link Bukti Bayar`
- Kolom J: `Nomor WhatsApp`
- Kolom K: `Username IG`
- Kolom L: `Sesi Pilihan`
- Kolom M: `Izin Dokumentasi`

## Langkah 4: Publikasikan / Deploy
1. Klik tombol **Terapkan / Deploy** → **Kelola deployment (Manage deployments)**.
2. Klik ikon **PENSIL** (Edit) di deployment Anda.
3. Di bagian "Versi", **ubah menjadi Versi Baru (New version)**.
4. Klik **Terapkan (Deploy)**. Selesai! URL script Anda tetap sama.

## Langkah 5: Hubungkan dengan Website
1. Buka file `main.js` website Anda.
2. Cari baris: `const GOOGLE_SCRIPT_URL = '...'`
3. Ganti URL-nya dengan URL deployment terbaru Anda. Selesai!
