# Setup Google Script 3D Frame Journaling

## Langkah 1: Siapkan Spreadsheet Baru atau Tab Sheet Baru

1. Buka kembali file [Google Spreadsheet Pendaftaran Workshop](https://docs.google.com/spreadsheets/d/1w8A69k0D1ZpE4o9_5nJ9Y4D275W_A-2tO6_1c0e3zX/edit).
2. Buat tab *Sheet* baru, beri nama **3d-frame-responses**.
3. Di baris pertama (Row 1), buat *Header Tabel* berikut ini secara berurutan, dari kolom A sampai S:

*   **A**: Timestamp (Otomatis diisi waktu submit)
*   **B**: Sesi Pilihan (Session)
*   **C**: Frame Terpilih (Tipe 1/2/3/4)
*   **D**: Nama Lengkap
*   **E**: Nomor Whatsapp
*   **F**: Username IG
*   **G**: Consent (Persetujuan Dokumentasi)
*   **H**: Bukti Pembayaran (URL gambar)
*   **I**: Foto 1 (URL gambar)
*   **J**: Foto 2 (URL gambar)
*   **K**: Foto 3 (URL gambar)
*   **L**: Foto 4 (URL gambar)

*(Tidak apa-apa jika desain kolom Anda di sheet berbeda posisi, pastikan script nanti *mapping* data sesuai posisi).*

## Langkah 2: Update Google Apps Script (.gs) Root Folder

1. Buka Google Spreadsheet di tab lama yang berisi *form responses* paper journal.
2. Di menu atas, pilih **Extensions -> Apps Script** (Ekstensi > Skrip Apps).
3. Anda akan melihat kode `Code.gs` yang sudah Anda tambahkan. Sekarang Anda harus meng-update logika fungsi `doPost(e)` agar Apps Script Anda dapat menangani 2 macam format workshop.

> [!CAUTION]
> Timpa / replace *fungsi doPost* sebelumnya dengan kode berikut yang mensupport multi-workshop.

```javascript
function doPost(e) {
  try {
    // 1. Parsing JSON data dari body request
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Format payload salah. Harus berupa JSON."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // =============== LOGIKA PENYARINGAN WORKSHOP ===============
    
    // --> ROUTE: 3D FRAME JOURNALING
    if (data.workshopType === '3d-frame-journaling') {
      var sheet = ss.getSheetByName("3d-frame-responses");
      if (!sheet) {
        throw new Error("Tab sheet '3d-frame-responses' tidak ditemukan");
      }

      var timestamp = new Date();
      var folder3DId = "MASUKKAN_ID_FOLDER_GOOGLE_DRIVE_DISINI"; // Ganti dengan Folder ID Anda
      var folder = DriveApp.getFolderById(folder3DId);
      
      var fileNamesAndUrls = {};
      var b64DataList = [
        { key: "bukti_bayar_" + data.fullName, b64: data.paymentBase64, prop: "paymentImg" },
        { key: "foto_1_" + data.fullName, b64: data.b64Photo1, prop: "photo1" },
        { key: "foto_2_" + data.fullName, b64: data.b64Photo2, prop: "photo2" },
        { key: "foto_3_" + data.fullName, b64: data.b64Photo3, prop: "photo3" },
        { key: "foto_4_" + data.fullName, b64: data.b64Photo4, prop: "photo4" },
      ];

      for (var i = 0; i < b64DataList.length; i++) {
        var item = b64DataList[i];
        if (item.b64) {
           var imageBlob = Utilities.newBlob(Utilities.base64Decode(item.b64), "image/jpeg", item.key + ".jpeg");
           var file = folder.createFile(imageBlob);
           file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
           fileNamesAndUrls[item.prop] = file.getUrl();
        } else {
           fileNamesAndUrls[item.prop] = "-";
        }
      }

      // Append Row ke Sheet 3D
      sheet.appendRow([
        timestamp,                  // A: Timestamp
        data.sessionSelected,       // B: Sesi Pilihan
        data.selectedFrame,         // C: Frame
        data.fullName,              // D: Nama Lengkap
        data.whatsapp,              // E: WA
        data.igUsername,            // F: IG
        data.consentCheck ? "Ya" : "Tidak", // G: Consent
        fileNamesAndUrls.paymentImg,// H: Bukti Bayar
        fileNamesAndUrls.photo1,    // I: Foto 1
        fileNamesAndUrls.photo2,    // J: Foto 2
        fileNamesAndUrls.photo3,    // K: Foto 3
        fileNamesAndUrls.photo4     // L: Foto 4
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Terima kasih, data berhasil direkam (3D Frame)"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // --> ROUTE: PAPER JOURNAL (Fallback / Asli)
    else {
      var sheet = ss.getSheetByName("Data Registrasi"); // Nama sheet pendaftaran paper journal Anda
      /*  
          Silakan tempelkan kode doPost logic yang lama disini. (misal ada kuota, uploadd file dll).
          Pastikan format appendRow nya sama seperti original Anda. 
      */
      
      /* CONTOH LOGIKA SEBELUMNYA:
      var timestamp = new Date();
      var folderId = "..."; 
      ...
      sheet.appendRow([...]); 
      */

      return ContentService.createTextOutput(JSON.stringify({
         status: "success",
         message: "Data Paper Journal berhasil direkam"
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Langkah 3: Tes Upload

Karena ada *4 foto dan 1 bukti pembayaran*, pastikan untuk membuat 1 buah sub-folder khusus pada Google Drive, lalu Anda isikan `MASUKKAN_ID_FOLDER_GOOGLE_DRIVE_DISINI` dengan folder id tersebut agar seluruh dokumen tidak berserakan.

**Setiap kali Anda mengubah kode**, Anda wajib menekan:
1. Klik **Deploy** -> **Manage Deployments** -> **Edit** (Icon Pensil).
2. Versinya buat *New version*.
3. Deploy ulang.
