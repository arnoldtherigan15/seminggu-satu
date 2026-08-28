// ============================================================
//  3D Layered Journaling Workshop — Registration Logic
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
let _workshopData = getWorkshopById("3d-frame-journaling"); // fallback rekening bank dkk (tetap type-level)
let _openBatches = [];
let _selectedBatchId = null;
let _isEarlyBird = false;
let _currentPrice = 0;

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

const discountPriceEl = document.getElementById('discountPriceEl');
const currentPriceEl = document.getElementById('currentPriceEl');
const paymentAmountEl = document.getElementById('paymentAmount');
const earlyBirdInfoEl = document.getElementById('earlyBirdInfo');
const earlyBirdTextEl = document.getElementById('earlyBirdText');

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
    _isEarlyBird = b.earlyBirdPrice != null && b.currentPrice < b.normalPrice;
    _currentPrice = b.currentPrice || 0;
    if (_isEarlyBird) {
        discountPriceEl.textContent = formatRupiah(b.normalPrice);
        discountPriceEl.style.display = '';
        currentPriceEl.textContent = formatRupiah(b.earlyBirdPrice);
        currentPriceEl.className = 'new-price';
        earlyBirdInfoEl.style.display = 'flex';
        earlyBirdTextEl.textContent = `Harga Early Bird sampai ${formatDateIndo(b.earlyBirdDueDate)}`;
    } else {
        discountPriceEl.style.display = 'none';
        currentPriceEl.textContent = formatRupiah(b.normalPrice);
        currentPriceEl.className = 'new-price';
        currentPriceEl.style.color = 'var(--text-primary)';
        currentPriceEl.style.animation = 'none';
    }
    paymentAmountEl.textContent = formatRupiah(_currentPrice);

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

// --- DOM Elements (ALL defined here before any function uses them) ---
const form = document.getElementById('workshopForm');
const submitBtn = document.getElementById('submitBtn');
const statusMessage = document.getElementById('statusMessage');
const urgencyBadge = document.getElementById('urgencyBadge');
const urgencyText = document.getElementById('urgencyText');

// --- Utilities ---
function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeUp 0.3s ease backwards reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showBlockerLoader(message = 'Memproses data...') {
    let blocker = document.getElementById('blockerLoader');
    document.getElementById('blockerMessage').textContent = message;
    blocker.classList.add('visible');
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
        _openBatches = (all && all['3d-frame-journaling']) || [];
    } catch (err) {
        console.error('Cek sesi gagal:', err);
        hideBlockerLoader();
        return; // fail-open -- server tetap validasi ulang pas submit
    }
    hideBlockerLoader();
    if (!_openBatches.length) {
        window.location.replace('../closed.html?workshop=3d-frame-journaling&reason=sold-out');
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

// --- Frame Selection Logic ---
const frameOptions = document.querySelectorAll('.frame-option');
const activeFrameImg = document.getElementById('activeFrameImg');
const inputSelectedFrame = document.getElementById('inputSelectedFrame');

frameOptions.forEach(option => {
    option.addEventListener('click', () => {
        frameOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        const frameId = option.getAttribute('data-frame');
        activeFrameImg.src = `../images/frame${frameId}.webp`;
        inputSelectedFrame.value = `Tipe ${frameId}`;
    });
});

// --- Photo Upload Logic (Compress & Preview) ---
async function handlePhotoUpload(inputId, boxId, previewImgId, slotId, b64Id) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    const previewImg = document.getElementById(previewImgId);
    const slot = document.getElementById(slotId);
    const b64Input = document.getElementById(b64Id);

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast("Ukuran gambar terlalu besar! Maksimal 5MB.");
            input.value = "";
            return;
        }

        try {
            // Foto ini DICETAK -> resolusi dijaga (1500px, q0.85): tajam buat print foto
            // di frame (~300 DPI sampai ~12cm) TAPI jauh lebih ringan dari 1600/0.9,
            // biar upload saat submit nggak lama. Sweet spot kualitas vs kecepatan.
            const compressedDataUrl = await compressImage(file, 1500, 0.85);

            // Set mini preview
            previewImg.src = compressedDataUrl;
            box.classList.add('has-image');

            // Set canvas slot
            slot.style.backgroundImage = `url(${compressedDataUrl})`;
            slot.classList.add('has-image');

            // Save base64 for form submission
            b64Input.value = compressedDataUrl.split(',')[1];
        } catch (error) {
            console.error(error);
            showToast('Gagal memproses gambar');
        }
    });
}

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

handlePhotoUpload('photo1', 'uploadBox1', 'preview1', 'slot1', 'b64Photo1');
handlePhotoUpload('photo2', 'uploadBox2', 'preview2', 'slot2', 'b64Photo2');
handlePhotoUpload('photo3', 'uploadBox3', 'preview3', 'slot3', 'b64Photo3');
handlePhotoUpload('photo4', 'uploadBox4', 'preview4', 'slot4', 'b64Photo4');

// Payment proof upload
const paymentInput = document.getElementById('paymentPhoto');
const paymentBox = document.getElementById('paymentUploadArea');
const paymentPreview = document.getElementById('paymentPreview');
const paymentB64 = document.getElementById('paymentBase64');

paymentInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const compressedDataUrl = await compressImage(file, 1000, 0.7);
        paymentPreview.src = compressedDataUrl;
        paymentBox.classList.add('has-image');
        paymentB64.value = compressedDataUrl.split(',')[1];
    } catch (err) {
        showToast("Error membaca foto pembayaran");
    }
});

// --- Copy to Clipboard ---
document.getElementById('copyBtn').addEventListener('click', () => {
    const accountNo = document.getElementById('accountNumber').textContent;
    navigator.clipboard.writeText(accountNo).then(() => {
        showToast("Berhasil disalin");
        const icon = document.querySelector('#copyBtn i');
        icon.setAttribute('data-lucide', 'check');
        icon.style.color = 'var(--success-color)';
        lucide.createIcons();
        setTimeout(() => {
            icon.setAttribute('data-lucide', 'copy');
            icon.style.color = '';
            lucide.createIcons();
        }, 2000);
    });
});

// --- Form Submission ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Config belum siap (jarang) -> jangan submit dgn data kosong
    if (!_workshopData) {
        showToast("Data workshop masih dimuat, tunggu sebentar ya.");
        return;
    }

    // Validate all photos are uploaded
    const requiredId = ['b64Photo1', 'b64Photo2', 'b64Photo3', 'b64Photo4', 'paymentBase64'];
    let valid = true;
    for (let id of requiredId) {
        if (!document.getElementById(id).value) {
            valid = false;
        }
    }
    if (!valid) {
        showToast("Mohon upload semua 4 foto dan bukti pembayaran");
        return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Mengirim Data...</span>';
    submitBtn.disabled = true;
    lucide.createIcons();
    showBlockerLoader("Mengirim data pendaftaran...");

    // Collect form data + photo base64 from hidden inputs
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.workshopType = '3d-frame-journaling';
    payload.batchId = _selectedBatchId || '';

    // Also grab b64 photos that are outside the form (in the visualizer section)
    payload.b64Photo1 = document.getElementById('b64Photo1').value;
    payload.b64Photo2 = document.getElementById('b64Photo2').value;
    payload.b64Photo3 = document.getElementById('b64Photo3').value;
    payload.b64Photo4 = document.getElementById('b64Photo4').value;

    // --- Re-cek slot sebelum submit (sesi yang DIPILIH) ---
    try {
        showBlockerLoader('Mengecek ketersediaan tiket...');
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
    } finally {
        hideBlockerLoader();
    }

    // Clean up unnecessary raw File objects since we send Base64
    delete payload.photo1;
    delete payload.photo2;
    delete payload.photo3;
    delete payload.photo4;
    delete payload.paymentPhoto;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
        showBlockerLoader("Mengirim data pendaftaran...");
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
                workshop: '3d-frame-journaling',
                batchId: payload.batchId || ''
            });
            if (new URLSearchParams(location.search).get('from') === 'member') params.set('from', 'member');
            window.location.href = '../success.html?' + params.toString();
        } else {
            throw new Error(result.message || "Unknown error occurred.");
        }
    } catch (error) {
        statusMessage.textContent = (error.name === 'AbortError')
            ? "Koneksi timeout. Data mungkin belum terkirim — cek internetmu lalu coba lagi. Kalau tetap gagal, hubungi admin ya."
            : ("Terjadi kesalahan: " + error.message);
        statusMessage.className = 'status-message error';
        statusMessage.style.display = 'block';
        statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
        clearTimeout(timeoutId);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        lucide.createIcons();
        hideBlockerLoader();
    }
});


// ============================================================
//  AUTO-UPDATE saat config server datang (biar harga/tanggal SELALU terbaru).
// ============================================================
window.addEventListener('workshops:updated', function () {
    _workshopData = getWorkshopById('3d-frame-journaling');
    loadOpenBatches();
});
