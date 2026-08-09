// ============================================================
//  Side by Side — Parent & Kid Journal Playdate — Registration Logic
//  (Seminggu Satu by Arnold)
// ============================================================

// --- Autofill nomor WA kalau lagi login di Balai Warga (session token
// dibaca dari localStorage, satu domain jadi kebaca dari sini juga) ---
(function autofillWaFromMemberSession() {
    var token = localStorage.getItem("ss_member_token");
    if (!token || typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) return;
    fetch(`${SUPABASE_URL}/functions/v1/member-session`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ token: token })
    }).then(function (res) { return res.json(); })
      .then(function (r) {
          var el = document.getElementById("whatsapp");
          if (el && !el.value && r && r.status === "success" && r.wa) {
              el.value = r.wa.replace(/^62/, "0");
          }
      })
      .catch(function () { /* diamkan, biarin user isi manual */ });
})();

// --- Kalau datang dari web warga (from=member), logo/tombol home balik
// ke portal warga, bukan homepage publik -- biar nggak berasa "keluar" ---
(function redirectHomeLinkToMemberPortal() {
    if (new URLSearchParams(location.search).get("from") !== "member") return;
    var link = document.getElementById("brandLink");
    if (link) link.href = "../warga/";
})();

// Config = sumber tunggal dari server (cache/live). Bisa null di kunjungan pertama
// (cache kosong) -> jangan crash; placeholder "Memuat..." + listener 'workshops:updated'.
let _workshopData = getWorkshopById("side-by-side");

// Beda dari workshop lain: early bird di sini bisa DIBATASI JUMLAH (earlyBirdMaxCount,
// mis. cuma 3 pendaftar pertama), bukan cuma tanggal. Jadi harga BARU final setelah
// kita tau jumlah pendaftar saat ini (dari workshop-counts) -- makanya harga
// nggak ditampilin optimis di awal kayak workshop lain, nunggu checkQuota() dulu.
let _lastCount = null;

function updatePriceDisplay() {
    const w = _workshopData;
    if (!w) return;
    const cur = getCurrentPrice(w, _lastCount);
    const eb = isEarlyBird(w, _lastCount) && w.normalPrice > cur;

    const dEl = document.getElementById('discountPriceEl');
    const cEl = document.getElementById('currentPriceEl');
    const pEl = document.getElementById('paymentAmount');
    const ebInfo = document.getElementById('earlyBirdInfo');
    const ebTxt = document.getElementById('earlyBirdText');

    if (eb) {
        if (dEl) { dEl.textContent = formatRupiah(w.normalPrice); dEl.style.display = ''; }
        if (cEl) { cEl.textContent = formatRupiah(w.earlyBirdPrice); cEl.className = 'new-price'; }
        if (ebInfo) ebInfo.style.display = 'flex';
        if (ebTxt) {
            ebTxt.textContent = w.earlyBirdMaxCount
                ? `Harga Early Bird — cuma buat ${w.earlyBirdMaxCount} pendaftar pertama, sampai ${formatDateIndo(w.earlyBirdDueDate)}`
                : `Harga Early Bird sampai ${formatDateIndo(w.earlyBirdDueDate)}`;
        }
    } else {
        if (dEl) dEl.style.display = 'none';
        if (cEl) { cEl.textContent = formatRupiah(w.normalPrice); cEl.className = 'new-price'; }
        if (ebInfo) ebInfo.style.display = 'none';
    }
    if (pEl) pEl.textContent = formatRupiah(cur);
}

// Nampilin/kunci section foto berdasarkan config -- dipanggil di load AWAL *dan* tiap
// config server datang (listener 'workshops:updated' di bawah). Kalau cuma dipanggil
// sekali di awal (waktu _workshopData masih null di kunjungan pertama tanpa cache),
// section foto bisa kepasang "required" pas submit tapi UI upload-nya nggak pernah
// ketampil -- warga jadi kejebak validasi tanpa cara buat isi Foto 1-4.
function applyPrintPhotoConfig(w) {
    if (!w || !w.isPrintPhoto) return;
    const section = document.getElementById('photoUploadSection');
    if (section) section.style.display = 'block';
    ['photo1', 'photo2', 'photo3', 'photo4'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.required = true;
    });
}

if (_workshopData) {
    document.getElementById('workshopDateText').textContent = _workshopData.workshopDate;
    document.getElementById('workshopTimeText').textContent = _workshopData.workshopTime;
    document.getElementById('locationNameText').textContent = _workshopData.locationName;
    document.getElementById('locationMapsLink').href = _workshopData.mapsLink;
    // Rekening pembayaran -- bisa di-config per workshop dari admin (kerja
    // sama pihak ketiga, bayar ke rekening mereka bukan Arnold). Fallback ke
    // rekening default kalau workshop-nya belum di-set (config lama).
    document.getElementById('bankNameText').textContent = _workshopData.bankName || 'BCA';
    document.getElementById('accountNumber').textContent = _workshopData.bankAccountNumber || '6042825961';
    document.getElementById('bankOwnerText').textContent = 'a.n ' + (_workshopData.bankAccountHolder || 'Arnold Therigan');

    applyPrintPhotoConfig(_workshopData);
    // Harga final nunggu checkQuota() (butuh count buat earlyBirdMaxCount) --
    // tapi kalau workshop ini nggak pake earlyBirdMaxCount, tampilin langsung
    // biar nggak nunggu-nunggu tanpa alasan.
    if (!_workshopData.earlyBirdMaxCount) updatePriceDisplay();
}

// DOM Elements
const submitBtn = document.getElementById('submitBtn');
const urgencyBadge = document.getElementById('urgencyBadge');
const urgencyText = document.getElementById('urgencyText');

function showBlockerLoader(message = 'Mengecek tiket...') {
    let blocker = document.getElementById('blockerLoader');
    if (blocker) {
        document.getElementById('blockerMessage').textContent = message;
        blocker.classList.add('visible');
    }
}

function hideBlockerLoader() {
    const blocker = document.getElementById('blockerLoader');
    if (blocker) blocker.classList.remove('visible');
}

// --- Helper: cek kuota tiap workshop (Edge Function workshop-counts) ---
function fetchWorkshopCounts(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 15000);
    return fetch(`${SUPABASE_URL}/functions/v1/workshop-counts`, {
        headers: { apikey: SUPABASE_ANON_KEY },
        signal: controller.signal
    }).then(res => { clearTimeout(timer); return res.json(); })
      .catch(err => { clearTimeout(timer); throw err; });
}

async function checkQuota() {
    showBlockerLoader('Mengecek ketersediaan tiket...');
    // Coba beberapa kali — Apps Script kadang lambat/dingin. Timeout per percobaan 9 dtk.
    let counts = null;
    for (let attempt = 1; attempt <= 2 && !counts; attempt++) {
        try {
            counts = await fetchWorkshopCounts(8000);
        } catch (err) {
            console.error(`Cek kuota gagal (percobaan ${attempt}/2):`, err);
        }
    }
    try {
        if (counts) {
            const currentCount = counts['side-by-side'] || 0;
            _lastCount = currentCount;
            updatePriceDisplay();

            const maxQuota = _workshopData.maxQuota || 15;
            const sisa = Math.max(0, maxQuota - currentCount);

            if (sisa <= 0) {
                // Blokir penuh — redirect ke closed.html, user tidak bisa lihat/scroll halaman
                window.location.replace('../closed.html?workshop=' + _workshopData.id + '&reason=sold-out');
                return;
            }
            urgencyBadge.classList.add('show');
            urgencyText.textContent = `Sisa ${sisa} Tiket!`;
        }
        // Kalau semua percobaan gagal (counts null): halaman tetap jalan, TAPI kuota
        // divalidasi ulang di server saat submit (handlePreSubmit) — jadi tetap aman.
        // Harga tetap tampil (fallback ke harga normal) biar nggak nge-block form selamanya.
        else if (_workshopData.earlyBirdMaxCount) {
            updatePriceDisplay();
        }
    } finally {
        hideBlockerLoader();
    }
}
// Cek kuota HANYA kalau config udah ada (butuh maxQuota & id). Kalau belum,
// dijalanin nanti pas config live masuk (lihat listener 'workshops:updated').
let _quotaChecked = false;
function runQuotaWhenReady() {
    if (_quotaChecked || !_workshopData) return;
    _quotaChecked = true;
    checkQuota();
}
runQuotaWhenReady();

// --- Image Compression ---
function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// Bungkus promise dengan batas waktu biar nggak nge-hang selamanya
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error((label || 'Proses') + ' timeout')), ms);
        promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
}

async function getCompressedBase64(file) {
    try {
        // Try canvas-based compression first (max 800px width/height, 0.7 quality)
        const compressedDataUrl = await withTimeout(compressImage(file, 800, 0.7), 20000, 'Kompres gambar');
        return compressedDataUrl.split(',')[1];
    } catch (err) {
        console.warn("Canvas compression failed, falling back to raw base64:", err);
        // Fallback to reading file directly as base64
        return await withTimeout(fileToBase64(file), 20000, 'Baca gambar');
    }
}

const selectedFiles = {};

function setupImageUpload(inputId, previewBoxId, previewImgId, cardImgId, cardSlotId) {
    const input = document.getElementById(inputId);
    const previewBox = document.getElementById(previewBoxId);
    const previewImg = document.getElementById(previewImgId);

    const cardImg = cardImgId ? document.getElementById(cardImgId) : null;
    const cardSlot = cardSlotId ? document.getElementById(cardSlotId) : null;

    if (!input) return;

    input.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // Limit 20MB
        if (file.size > 20 * 1024 * 1024) {
            alert("Ukuran gambar terlalu besar! Maksimal 20MB.");
            input.value = "";
            previewBox.classList.remove('has-image');
            if (cardSlot) cardSlot.classList.remove('has-image');
            delete selectedFiles[inputId];
            return;
        }

        const isHeic = file.name.toLowerCase().endsWith('.heic') ||
                       file.name.toLowerCase().endsWith('.heif') ||
                       file.type === 'image/heic' ||
                       file.type === 'image/heif';

        let targetBlob = file;

        if (isHeic) {
            if (typeof heic2any === 'undefined') {
                alert("Pustaka konverter HEIC belum dimuat.");
                return;
            }
            showBlockerLoader("Mengonversi foto HEIC ke JPEG...");
            try {
                const result = await heic2any({
                    blob: file,
                    toType: "image/jpeg",
                    quality: 0.8
                });
                targetBlob = Array.isArray(result) ? result[0] : result;
            } catch (err) {
                console.error("HEIC conversion error:", err);
                alert("Gagal memproses berkas HEIC. Silakan gunakan format JPG atau PNG.");
                input.value = "";
                previewBox.classList.remove('has-image');
                if (cardSlot) cardSlot.classList.remove('has-image');
                delete selectedFiles[inputId];
                return;
            } finally {
                hideBlockerLoader();
            }
        }

        // Store targetBlob in selectedFiles (converted JPEG)
        selectedFiles[inputId] = targetBlob;

        // Instant preview using Object URL (safe for converted JPEG)
        const objectUrl = URL.createObjectURL(targetBlob);
        previewImg.src = objectUrl;
        previewBox.classList.add('has-image');

        if (cardImg && cardSlot) {
            cardImg.src = objectUrl;
            cardSlot.classList.add('has-image');
        }
    });
}

// --- Copy to Clipboard ---
document.getElementById('copyBtn').addEventListener('click', () => {
    const accountNo = document.getElementById('accountNumber').textContent;
    navigator.clipboard.writeText(accountNo).then(() => {
        alert("Nomor rekening berhasil disalin");
    });
});

// --- Form Submission ---
const form = document.getElementById('workshopForm');
const statusMessage = document.getElementById('statusMessage');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Config belum siap (jarang) -> jangan submit dgn data kosong
    if (!_workshopData) {
        alert("Data workshop masih dimuat, tunggu sebentar ya.");
        return;
    }

    const originalBtnText = submitBtn.innerHTML;

    // --- Validation ---
    const missing = [];
    if (!form.parentName.value.trim()) missing.push('Nama Orang Tua');
    if (!form.childName.value.trim()) missing.push('Nama Anak');
    if (!form.nickname.value.trim()) missing.push('Nickname');
    if (!form.whatsapp.value.trim()) missing.push('Nomor WhatsApp');

    if (_workshopData.isPrintPhoto) {
        ['photo1', 'photo2', 'photo3', 'photo4'].forEach(id => {
            const inp = document.getElementById(id);
            if (!inp || (!inp.files || inp.files.length === 0) && !selectedFiles[id]) {
                missing.push(`Foto ${id.replace('photo', '')}`);
            }
        });
    }

    const payInp = document.getElementById('paymentPhoto');
    if (!payInp || (!payInp.files || payInp.files.length === 0) && !selectedFiles['paymentPhoto']) {
        missing.push('Bukti Pembayaran');
    }

    if (missing.length) {
        alert('Harap isi semua field yang diperlukan:\n' + missing.join('\n'));
        return;
    }

    submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Memproses Gambar...</span>';
    submitBtn.disabled = true;
    lucide.createIcons();
    statusMessage.className = 'status-message';
    statusMessage.style.display = 'none';

    showBlockerLoader("Mengompresi foto & bukti pembayaran...");

    // Process and compress image files to base64 inputs asynchronously before submitting
    try {
        if (_workshopData.isPrintPhoto) {
            const p1 = selectedFiles['photo1'] || document.getElementById('photo1').files[0];
            const p2 = selectedFiles['photo2'] || document.getElementById('photo2').files[0];
            const p3 = selectedFiles['photo3'] || document.getElementById('photo3').files[0];
            const p4 = selectedFiles['photo4'] || document.getElementById('photo4').files[0];

            document.getElementById('photo1Base64').value = await getCompressedBase64(p1);
            document.getElementById('photo1MimeType').value = 'image/jpeg';

            document.getElementById('photo2Base64').value = await getCompressedBase64(p2);
            document.getElementById('photo2MimeType').value = 'image/jpeg';

            document.getElementById('photo3Base64').value = await getCompressedBase64(p3);
            document.getElementById('photo3MimeType').value = 'image/jpeg';

            document.getElementById('photo4Base64').value = await getCompressedBase64(p4);
            document.getElementById('photo4MimeType').value = 'image/jpeg';
        }

        const paymentFile = selectedFiles['paymentPhoto'] || document.getElementById('paymentPhoto').files[0];
        document.getElementById('paymentBase64').value = await getCompressedBase64(paymentFile);
        document.getElementById('paymentMimeType').value = 'image/jpeg';

    } catch (compressErr) {
        hideBlockerLoader();
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        lucide.createIcons();
        alert("Gagal memproses gambar: " + compressErr.message);
        return;
    }

    submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Mengirim Data...</span>';
    lucide.createIcons();
    showBlockerLoader("Mengirim data pendaftaran...");

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.workshopType = 'side-by-side';
    payload.isPrintPhoto = _workshopData.isPrintPhoto;

    // Double check quota before submitting
    try {
        const counts = await fetchWorkshopCounts();
        const currentCount = counts['side-by-side'] || 0;
        const maxQuota = _workshopData.maxQuota || 15;

        if (currentCount >= maxQuota) {
            hideBlockerLoader();
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="x-circle"></i> <span>Pendaftaran Penuh</span>';
            lucide.createIcons();
            alert("Maaf, kuota baru saja penuh. Pendaftaran Anda tidak dapat dilanjutkan.");
            return;
        }
    } catch (err) {
        console.warn('Quota re-check failed, continuing submit:', err);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 dtk maksimal
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/register-workshop`, {
            method: 'POST',
            headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.status === 'success') {
            const params = new URLSearchParams({
                name: payload.parentName || 'Peserta',
                childName: payload.childName || '',
                whatsapp: payload.whatsapp || '',
                workshop: 'side-by-side'
            });
            if (new URLSearchParams(location.search).get('from') === 'member') params.set('from', 'member');

            window.location.href = '../success.html?' + params.toString();
        } else {
            throw new Error(result.message || "Terjadi kesalahan pada server.");
        }
    } catch (error) {
        const msg = (error.name === 'AbortError')
            ? "Koneksi timeout. Data mungkin belum terkirim — cek koneksi internetmu lalu coba lagi. Kalau tetap gagal, hubungi admin ya."
            : ("Terjadi kesalahan pendaftaran: " + error.message);
        statusMessage.textContent = msg;
        statusMessage.className = 'status-message error';
        statusMessage.style.display = 'block';
        statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
        clearTimeout(timeoutId);
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        lucide.createIcons();
        hideBlockerLoader();
    }
});

// Initialize image uploads
setupImageUpload('photo1', 'photo1UploadArea', 'photo1Preview', 'cardImg1', 'previewSlot1');
setupImageUpload('photo2', 'photo2UploadArea', 'photo2Preview', 'cardImg2', 'previewSlot2');
setupImageUpload('photo3', 'photo3UploadArea', 'photo3Preview', 'cardImg3', 'previewSlot3');
setupImageUpload('photo4', 'photo4UploadArea', 'photo4Preview', 'cardImg4', 'previewSlot4');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview');


// ============================================================
//  AUTO-UPDATE saat config server datang (biar harga/tanggal SELALU terbaru,
//  nggak pernah nampilin cache/statis lama). Aman: pakai guard if(el).
// ============================================================
window.addEventListener('workshops:updated', function () {
    try {
        var w = getWorkshopById("side-by-side"); if (!w) return;
        _workshopData = w;
        applyPrintPhotoConfig(w);
        updatePriceDisplay();
        var dt = document.getElementById('workshopDateText'); if (dt) dt.textContent = w.workshopDate || '';
        var tm = document.getElementById('workshopTimeText'); if (tm) tm.textContent = w.workshopTime || '';
        var ln = document.getElementById('locationNameText'); if (ln) ln.textContent = w.locationName || '';
        var ml = document.getElementById('locationMapsLink'); if (ml && w.mapsLink) ml.href = w.mapsLink;
        var bn = document.getElementById('bankNameText'); if (bn) bn.textContent = w.bankName || 'BCA';
        var an = document.getElementById('accountNumber'); if (an) an.textContent = w.bankAccountNumber || '6042825961';
        var bo = document.getElementById('bankOwnerText'); if (bo) bo.textContent = 'a.n ' + (w.bankAccountHolder || 'Arnold Therigan');
        runQuotaWhenReady();   // config baru siap -> cek kuota kalau belum
    } catch (e) { /* jangan ganggu halaman */ }
});
