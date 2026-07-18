// ============================================================
//  Reka Rekat Journaling Date — Registration & Visualizer Logic
//  (Seminggu Satu by Arnold)
// ============================================================

// Config = sumber tunggal dari server (cache/live). Bisa null di kunjungan pertama
// (cache kosong) -> jangan crash; placeholder "Memuat..." + listener 'workshops:updated'.
let _workshopData = getWorkshopById("reka-rekat");
let _currentPrice = _workshopData ? getCurrentPrice(_workshopData) : 0;

if (_workshopData) {
    document.getElementById('currentPriceEl').textContent = formatRupiah(_currentPrice);
    document.getElementById('paymentAmount').textContent = formatRupiah(_currentPrice);
    document.getElementById('workshopDateText').textContent = _workshopData.workshopDate;
    document.getElementById('workshopTimeText').textContent = _workshopData.workshopTime;
    document.getElementById('locationNameText').textContent = _workshopData.locationName;
    document.getElementById('locationMapsLink').href = _workshopData.mapsLink;

    // Show or hide photo upload section based on config
    if (_workshopData.isPrintPhoto) {
        document.getElementById('photoUploadSection').style.display = 'block';

        // Make photo inputs required if section is visible
        document.getElementById('photo1').required = true;
        document.getElementById('photo2').required = true;
        document.getElementById('photo3').required = true;
        document.getElementById('photo4').required = true;
    }
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

function fetchJSONP(url, callbackPrefix, timeoutMs) {
    return new Promise((resolve, reject) => {
        const callbackName = callbackPrefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            reject(new Error("Request timeout"));
            delete window[callbackName];
            script.remove();
        }, timeoutMs || 15000);

        window[callbackName] = function (data) {
            clearTimeout(timeout);
            resolve(data);
            delete window[callbackName];
            script.remove();
        };

        script.src = `${url}?callback=${callbackName}`;
        script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Failed to load script"));
            delete window[callbackName];
            script.remove();
        };
        document.body.appendChild(script);
    });
}

async function checkQuota() {
    showBlockerLoader('Mengecek ketersediaan tiket...');
    // Coba beberapa kali — Apps Script kadang lambat/dingin. Timeout per percobaan 9 dtk.
    let counts = null;
    for (let attempt = 1; attempt <= 2 && !counts; attempt++) {
        try {
            counts = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handleQuota', 8000);
        } catch (err) {
            console.error(`Cek kuota gagal (percobaan ${attempt}/2):`, err);
        }
    }
    try {
        if (counts) {
            const currentCount = counts['reka-rekat'] || 0;
            const maxQuota = _workshopData.maxQuota || 18;
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
    if (!form.fullName.value.trim()) missing.push('Nama Lengkap');
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
    payload.workshopType = 'reka-rekat';
    payload.isPrintPhoto = _workshopData.isPrintPhoto;

    // Double check quota before submitting
    try {
        const counts = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handlePreSubmit');
        const currentCount = counts['reka-rekat'] || 0;
        const maxQuota = _workshopData.maxQuota || 18;

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
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.status === 'success') {
            const params = new URLSearchParams({
                name: payload.fullName || 'Peserta',
                whatsapp: payload.whatsapp || '',
                workshop: 'reka-rekat'
            });

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
        var w = getWorkshopById("reka-rekat"); if (!w) return;
        var eb = (typeof isEarlyBird === 'function') && isEarlyBird(w);
        var cur = getCurrentPrice(w);
        _workshopData = w; _currentPrice = cur;   // simpan buat checkQuota & submit
        var dEl = document.getElementById('discountPriceEl');
        var cEl = document.getElementById('currentPriceEl');
        var pEl = document.getElementById('paymentAmount');
        var ebInfo = document.getElementById('earlyBirdInfo');
        var ebTxt = document.getElementById('earlyBirdText');
        if (eb) {
            if (dEl) { dEl.textContent = formatRupiah(w.normalPrice); dEl.style.display = ''; }
            if (cEl) { cEl.textContent = formatRupiah(w.earlyBirdPrice); cEl.className = 'new-price'; }
            if (ebInfo) ebInfo.style.display = 'flex';
            if (ebTxt) ebTxt.textContent = 'Harga Early Bird sampai ' + formatDateIndo(w.earlyBirdDueDate);
        } else {
            if (dEl) dEl.style.display = 'none';
            if (cEl) { cEl.textContent = formatRupiah(w.normalPrice); cEl.className = 'new-price'; cEl.style.color = 'var(--text-primary)'; }
            if (ebInfo) ebInfo.style.display = 'none';
        }
        if (pEl) pEl.textContent = formatRupiah(cur);
        var dt = document.getElementById('workshopDateText'); if (dt) dt.textContent = w.workshopDate || '';
        var tm = document.getElementById('workshopTimeText'); if (tm) tm.textContent = w.workshopTime || '';
        var ln = document.getElementById('locationNameText'); if (ln) ln.textContent = w.locationName || '';
        var ml = document.getElementById('locationMapsLink'); if (ml && w.mapsLink) ml.href = w.mapsLink;
        runQuotaWhenReady();   // config baru siap -> cek kuota kalau belum
    } catch (e) { /* jangan ganggu halaman */ }
});
