# Panduan Setup Unified Google Script (Seminggu Satu)

Gunakan satu script ini untuk menangani **semua** workshop Anda dalam satu file Google Spreadsheet yang sama namun dengan tab yang berbeda.

## Langkah 1: Siapkan Spreadsheet
Pastikan di spreadsheet Anda ([buka link sheet Anda](https://docs.google.com/spreadsheets/d/1Wtq0WoWL_3J6bEYNyWPwFrawU2QXcTnlZ2jFynaeeRU/edit)) memiliki tab-tab dengan nama berikut:
1.  **`paper-journal-17-mei-2026`**
2.  **`3d-frame-25-april-2026`**

> [!TIP]
> Pastikan baris pertama (Header) di setiap tab sudah sesuai dengan urutan kolom yang Anda inginkan (Timestamp, Nama Lengkap, dst).

## Langkah 2: Update Apps Script
1.  Buka Spreadsheet Anda, pilih menu **Extensions > Apps Script**.
2.  Hapus semua kode lama di sana.
3.  Buka file [Google_Script_Code.js](file:///Users/arnoldtherigan/Downloads/seminggu_satu/Google_Script_Code.js) yang baru saya buat, copy Isinya.
4.  Paste ke dalam editor Apps Script.
5.  Pastikan `FOLDER_ID` di baris atas adalah `1Hfz4CvxLW02NTlmrj3r95uhOi2mYD5Of`.

## Langkah 3: Deploy Ulang (PENTING)
Setiap kali ada perubahan kode, Anda harus melakukan "Deploy" ulang:
1.  Klik tombol **Deploy** di kanan atas > **Manage Deployments**.
2.  Klik icon **Pensil (Edit)**.
3.  Pilih **Version: New Version**.
4.  Klik **Deploy**.
5.  Gunakan URL yang dihasilkan untuk ditaruh di `WORKSHOP_CONFIG` jika Anda mengubah alamatnya.

---
### Checklist Perbaikan Hari Ini:
*   `[x]` **Redirection Home**: Sudah diperbaiki agar langsung buka `index.html` (Tidak lagi directory listing).
*   `[x]` **Tombol Foto 3D**: Sudah diperbaiki logic `z-index`-nya agar bisa diklik.
*   `[x]` **Social Links**: Sudah ditambahkan di halaman 3D Frame.
*   `[x]` **Hapus Sesi**: Form tidak lagi meminta pilih sesi, langsung ke tanggal fix.
*   `[x]` **Success Ticket**: Tiket sekarang otomatis menampilkan tanggal workshop yang relevan (17 Mei untuk PJ, 25 April untuk 3D).
