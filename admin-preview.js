/* Pratinjau admin buat halaman pendaftaran event.
 *
 * Halaman event normalnya ngalihin pengunjung ke closed.html kalau event
 * nonaktif / pendaftaran tutup / nggak ada batch yang buka. Admin tetap
 * butuh LIHAT halamannya (mis. ngecek tampilan sebelum dibuka lagi), jadi:
 *   ?preview=1  +  browser ini lagi login admin (token admin di localStorage)
 *   -> nggak dialihin, ada spanduk "Pratinjau admin", dan semua kiriman
 *      (daftar, upload foto) DIBLOKIR di sini, jadi nggak mungkin ada data
 *      pendaftar palsu yang masuk.
 * Ini cuma soal tampilan: isi halaman (config event) memang publik.
 */
(function () {
  var on = false;
  try { on = /[?&]preview=1(&|$)/.test(location.search) && !!localStorage.getItem("ss_admin_token"); } catch (e) { on = false; }
  window.SS_ADMIN_PREVIEW = on;
  if (!on) { window.ssPreviewBatches = function (list) { return list; }; return; }

  // Kalau nggak ada batch yang buka, pakai data config event sebagai batch pratinjau
  window.ssPreviewBatches = function (list, id) {
    list = list || [];
    if (list.some(function (b) { return !b.hideFromPicker; })) return list;
    var w = (typeof getWorkshopById === "function" && getWorkshopById(id)) || {};
    return list.concat([Object.assign({}, w, { id: "preview", label: "Pratinjau", hideFromPicker: false, active: true })]);
  };

  // Blokir semua kiriman ke server (yang cuma baca data tetap boleh)
  var READ_OK = /\/functions\/v1\/(workshop-batches|workshop-counts|member-check)/;
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (method !== "GET" && /supabase\.co/.test(url) && !READ_OK.test(url)) {
      alert("Ini pratinjau admin. Formulir nggak dikirim, nggak ada data yang tersimpan.");
      return Promise.reject(new Error("Pratinjau admin: kiriman dimatikan"));
    }
    return origFetch.apply(this, arguments);
  };

  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText = "position:sticky;top:0;z-index:99999;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:10px 16px;background:#ffe500;color:#10245e;font:700 14px/1.4 'Outfit','Open Sans',system-ui,sans-serif;text-align:center;box-shadow:0 2px 0 rgba(16,36,94,.15);";
    bar.innerHTML = "Pratinjau admin &mdash; pengunjung biasa lihat halaman ini sebagai <u>tutup</u>. Formulir nggak bakal terkirim.";
    document.body.insertBefore(bar, document.body.firstChild);
  });
})();
