/**
 * ============================================================
 * UNIFIED GOOGLE APPS SCRIPT — SEMINGGU SATU
 * ============================================================
 * 
 * Panduan:
 * 1. Tempelkan kode ini di Google Apps Script (Code.gs).
 * 2. Ubah FOLDER_ID sesuai dengan folder Google Drive Anda.
 * 3. Deploy sebagai Web App (EveryOne can access).
 */

const FOLDER_ID = "1Hfz4CvxLW02NTlmrj3r95uhOi2mYD5Of";

/**
 * Handle GET requests for quota checking (JSONP supported)
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet3D = ss.getSheetByName("3d-frame-25-april-2026");
    const sheetPJ = ss.getSheetByName("paper-journal-17-mei-2026");

    const counts = {
      "3d-frame-journaling": sheet3D ? Math.max(0, sheet3D.getLastRow() - 1) : 0,
      "paper-journal": sheetPJ ? Math.max(0, sheetPJ.getLastRow() - 1) : 0
    };

    const result = JSON.stringify(counts);
    const callback = e.parameter.callback;

    if (callback) {
      return ContentService.createTextOutput(callback + "(" + result + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService.createTextOutput(result)
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const timestamp = new Date();

    // --------------------------------------------------------
    // ROUTE: 3D FRAME JOURNALING
    // --------------------------------------------------------
    if (data.workshopType === '3d-frame-journaling') {
      const sheet = ss.getSheetByName("3d-frame-25-april-2026");
      if (!sheet) throw new Error("Sheet '3d-frame-25-april-2026' tidak ditemukan");

      // Upload Images
      const files = {
        payment: uploadFile(folder, data.paymentBase64, "Bukti_" + data.fullName),
        photo1: uploadFile(folder, data.b64Photo1, "Photo1_" + data.fullName),
        photo2: uploadFile(folder, data.b64Photo2, "Photo2_" + data.fullName),
        photo3: uploadFile(folder, data.b64Photo3, "Photo3_" + data.fullName),
        photo4: uploadFile(folder, data.b64Photo4, "Photo4_" + data.fullName)
      };

      // Append Row (Following screenshot order)
      // A:Timestamp, B:Frame, C:Nama, D:WA, E:IG, F:Consent, G:Payment, H:Photo1, I:Photo2, J:Photo3, K:Photo4
      sheet.appendRow([
        timestamp,
        data.selectedFrame,
        data.fullName,
        "'" + data.whatsapp, // Prefix ' to keep as string
        data.igUsername,
        data.consentCheck === 'on' ? 'Ya' : 'Tidak',
        files.payment,
        files.photo1,
        files.photo2,
        files.photo3,
        files.photo4
      ]);

      return createResponse("success", "Pendaftaran 3D Frame Berhasil");
    }

    // --------------------------------------------------------
    // ROUTE: PAPER JOURNAL
    // --------------------------------------------------------
    else if (data.workshopType === 'paper-journal') {
      const sheet = ss.getSheetByName("paper-journal-17-mei-2026");
      if (!sheet) throw new Error("Sheet 'paper-journal-17-mei-2026' tidak ditemukan");

      // Upload Images
      const files = {
        charm: uploadFile(folder, data.charmBase64, "Charm_" + data.fullName),
        payment: uploadFile(folder, data.paymentBase64, "Bukti_" + data.fullName)
      };

      // Append Row (Following user description order)
      // Timestamp, Nama, Inisial, FrontWord, Cover, Flap, Tali, CharmImg, BuktiBayar, WA, IG, Consent
      sheet.appendRow([
        timestamp,
        data.fullName,
        data.initial,
        data.frontCoverWord,
        data.colorBody,
        data.colorFlap,
        data.colorStrap,
        files.charm,
        files.payment,
        "'" + data.whatsapp,
        data.igUsername,
        data.consentCheck === 'on' ? 'Ya' : 'Tidak'
      ]);

      return createResponse("success", "Pendaftaran Paper Journal Berhasil");
    }

    throw new Error("Workshop Type tidak dikenali: " + data.workshopType);

  } catch (err) {
    return createResponse("error", err.message);
  }
}

/** Helper: Upload B64 to Drive and return URL */
function uploadFile(folder, base64, fileName) {
  if (!base64) return "-";
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), "image/jpeg", fileName + ".jpg");
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    return "Error Upload: " + e.message;
  }
}

/** Helper: Create JSON Response */
function createResponse(status, message) {
  const result = JSON.stringify({ status: status, message: message });
  return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.JSON);
}
