// ============================================================
//  Reka Rekat Journaling Date — Registration & Visualizer Logic
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

// --- Sesi/batch yang lagi buka + harga (bisa beda per batch) ---
// Ganti logic lama yang baca Config doang (getWorkshopById, 1 nilai per tipe)
// -- sekarang ambil dari workshop-batches, override batch > Config udah
// digabung server-side, per SESI yang beneran buka (bisa 2+ barengan).
let _workshopData = getWorkshopById("reka-rekat"); // fallback rekening bank & isPrintPhoto (tetap type-level)
let _openBatches = [];
let _selectedBatchId = null;

// Direct-link ke sesi tertentu, mis. ?vol=5 atau ?batch=Vol%205 -- dicari
// dulu match PERSIS ke label batch (case-insensitive), kalau nggak ketemu
// & query-nya angka, dicoba match ke angka yang ada di label ("Vol 5" -> 5).
function matchBatchFromQuery() {
    const params = new URLSearchParams(location.search);
    const q = (params.get('vol') || params.get('batch') || '').trim();
    if (!q) return null;
    const exact = _openBatches.find(function (b) { return String(b.label || '').toLowerCase() === q.toLowerCase(); });
    if (exact) return exact.id;
    const qNum = q.match(/\d+/);
    if (!qNum) return null;
    const numMatch = _openBatches.find(function (b) {
        const m = String(b.label || '').match(/\d+/);
        return m && m[0] === qNum[0];
    });
    return numMatch ? numMatch.id : null;
}
let _currentPrice = 0;

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
applyPrintPhotoConfig(_workshopData);

function getSelectedBatch() { return _openBatches.find(function (b) { return b.id === _selectedBatchId; }) || null; }

function renderBatchPicker() {
    const box = document.getElementById('batchPicker');
    if (!box) return;
    // Sesi yang ditandain hideFromPicker (masih aktif, cuma link-only) nggak
    // ditampilin di sini -- cuma bisa dijangkau lewat ?vol=/?batch= langsung.
    const visibleBatches = _openBatches.filter(function (b) { return !b.hideFromPicker; });
    if (visibleBatches.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = '<p style="font-size:0.85rem;font-weight:600;margin:0 0 8px;">Pilih sesi:</p>' +
        visibleBatches.map(function (b) {
            return '<div class="batch-opt" data-batch="' + b.id + '" style="border:2px solid ' + (b.id === _selectedBatchId ? 'var(--brand,#5e72e4)' : '#e5e7eb') + ';border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;">' +
                '<div style="font-weight:700;">' + (b.label || 'Sesi') + '</div>' +
                '<div style="font-size:0.82rem;color:#6b7280;">' + (b.displayDate || '-') + (b.workshopTime ? ' · ' + b.workshopTime : '') + ' — sisa ' + (b.remaining == null ? '?' : b.remaining) + ' slot</div></div>';
        }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-batch]'), function (el) {
        el.addEventListener('click', function () {
            _selectedBatchId = el.dataset.batch;
            renderBatchPicker();
            applyBatchDisplay();
        });
    });
}

function applyBatchDisplay() {
    const b = getSelectedBatch();
    if (!b) return;
    _currentPrice = b.currentPrice || 0;
    document.getElementById('currentPriceEl').textContent = formatRupiah(_currentPrice);
    document.getElementById('paymentAmount').textContent = formatRupiah(_currentPrice);
    document.getElementById('workshopDateText').textContent = b.displayDate || '';
    document.getElementById('workshopTimeText').textContent = b.workshopTime || '';
    document.getElementById('locationNameText').textContent = b.locationName || '';
    if (b.mapsLink) document.getElementById('locationMapsLink').href = b.mapsLink;
    // Rekening pembayaran -- tetap type-level (kerja sama pihak ketiga bisa
    // beda rekening per WORKSHOP, tapi ga masuk akal beda per batch/sesi).
    const w = _workshopData;
    document.getElementById('bankNameText').textContent = (w && w.bankName) || 'BCA';
    document.getElementById('accountNumber').textContent = (w && w.bankAccountNumber) || '6042825961';
    document.getElementById('bankOwnerText').textContent = 'a.n ' + ((w && w.bankAccountHolder) || 'Arnold Therigan');
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

// Ambil daftar sesi yang lagi buka -- ganti checkQuota()/fetchWorkshopCounts()
// lama (yang cuma baca total per TIPE). Dipanggil pas load & pas config
// server ke-refresh ('workshops:updated').
async function loadOpenBatches() {
    showBlockerLoader('Mengecek ketersediaan tiket...');
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/workshop-batches`, { headers: { apikey: SUPABASE_ANON_KEY }, signal: controller.signal });
        clearTimeout(timer);
        const all = await res.json();
        _openBatches = (all && all['reka-rekat']) || [];
    } catch (err) {
        console.error('Cek sesi gagal:', err);
        hideBlockerLoader();
        return; // fail-open -- server tetap validasi ulang pas submit
    }
    hideBlockerLoader();
    if (!_openBatches.length) {
        window.location.replace('../closed.html?workshop=reka-rekat&reason=sold-out');
        return;
    }
    if (!_selectedBatchId || !_openBatches.find(function (b) { return b.id === _selectedBatchId; })) {
        const visible = _openBatches.filter(function (b) { return !b.hideFromPicker; });
        _selectedBatchId = matchBatchFromQuery() || (visible[0] || _openBatches[0]).id;
    }
    renderBatchPicker();
    applyBatchDisplay();
    urgencyBadge.classList.add('show');
    const left = getSelectedBatch().remaining;
    urgencyText.textContent = left == null ? 'Tiket tersedia' : `Sisa ${left} Tiket!`;
}
loadOpenBatches();

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
            img.onerror = () => reject(new Error("Gagal memuat gambar buat dikompres -- coba pilih ulang fotonya."));
        };
        reader.onerror = () => reject(new Error("Gagal membaca file gambar -- coba pilih ulang fotonya."));
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error("Gagal membaca file gambar -- coba pilih ulang fotonya."));
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
    payload.batchId = _selectedBatchId || '';
    payload.isPrintPhoto = _workshopData.isPrintPhoto;

    // Double check quota before submitting (sesi yang DIPILIH)
    try {
        await loadOpenBatches();
        const b = getSelectedBatch();
        if (b && b.remaining != null && b.remaining <= 0) {
            hideBlockerLoader();
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="x-circle"></i> <span>Pendaftaran Penuh</span>';
            lucide.createIcons();
            alert("Maaf, kuota baru saja penuh. Pendaftaran Anda tidak dapat dilanjutkan.");
            return;
        }
        payload.batchId = _selectedBatchId || '';
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
                name: payload.fullName || 'Peserta',
                whatsapp: payload.whatsapp || '',
                workshop: 'reka-rekat',
                batchId: payload.batchId || ''
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
//  AUTO-UPDATE saat config server datang (biar harga/tanggal SELALU terbaru).
// ============================================================
window.addEventListener('workshops:updated', function () {
    _workshopData = getWorkshopById('reka-rekat');
    applyPrintPhotoConfig(_workshopData);
    loadOpenBatches();
});
