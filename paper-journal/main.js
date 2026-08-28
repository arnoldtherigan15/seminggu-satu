// ============================================================
//  Paper Journal Creative Workshop — Registration Logic
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
let _workshopData = getWorkshopById("paper-journal"); // fallback rekening bank dkk (tetap type-level)
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
let _isEarlyBird = false;
let _currentPrice = 0;

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
        _openBatches = (all && all['paper-journal']) || [];
    } catch (err) {
        console.error('Cek sesi gagal:', err);
        // Gagal cek -- fail-open, halaman tetap jalan (server tetap validasi
        // ulang saat submit; tanpa batchId eksplisit server auto-pilih kalau
        // cuma 1 sesi yang buka).
        hideBlockerLoader();
        return;
    }
    hideBlockerLoader();
    if (!_openBatches.length) {
        window.location.replace('../closed.html?workshop=paper-journal&reason=sold-out');
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
window.addEventListener('workshops:updated', function () { _workshopData = getWorkshopById('paper-journal'); loadOpenBatches(); });


// ============================================================
//  Data Warna (Cover & Tutup)
// ============================================================
const colors = [
    { name: 'Putih Tulang', hex: '#e6e3da', isAvailable: true },
    { name: 'Beige Krem', hex: '#d3c4ac', isAvailable: true },
    { name: 'Coklat Muda', hex: '#c1a88a', isAvailable: true },
    { name: 'Kuning Muda', hex: '#e7dd5e', isAvailable: true },
    { name: 'Kuning', hex: '#dccf43', isAvailable: true },
    { name: 'Orange', hex: '#e94630', isAvailable: true },
    { name: 'Merah', hex: '#d7181e', isAvailable: true },
    { name: 'Pink Muda', hex: '#e4b9c8', isAvailable: true },
    { name: 'Pink Magenta', hex: '#f2507b', isAvailable: true },
    { name: 'Ungu Muda', hex: '#827cba', isAvailable: true },
    { name: 'Ungu Tua', hex: '#7e4da5', isAvailable: true },
    { name: 'Biru Pastel', hex: '#7dc9f0', isAvailable: true },
    { name: 'Biru Tua', hex: '#0955a0', isAvailable: true },
    { name: 'Mint', hex: '#8ebc9f', isAvailable: true },
    { name: 'Hijau Pastel', hex: '#aecdbb', isAvailable: true },
    { name: 'Hijau Tua', hex: '#0c5c3c', isAvailable: true },
    { name: 'Coklat', hex: '#764432', isAvailable: true },
    { name: 'Hitam', hex: '#2f2f31', isAvailable: true }
];

// Data Warna Khusus Tali
const strapColors = [
    { name: 'Putih', hex: '#ebe5e5', isAvailable: true },
    { name: 'Cream', hex: '#cfac8c', isAvailable: true },
    { name: 'Kuning', hex: '#fde355', isAvailable: true },
    { name: 'Stabilo', hex: '#9dde6d', isAvailable: true },
    { name: 'Orange', hex: '#f05e37', isAvailable: true },
    { name: 'Merah', hex: '#b71c2c', isAvailable: true },
    { name: 'Pink', hex: '#f3c3b9', isAvailable: true },
    { name: 'Pink Magenta', hex: '#b65179', isAvailable: true },
    { name: 'Ungu', hex: '#692f4a', isAvailable: true },
    { name: 'Hijau', hex: '#97ab52', isAvailable: true },
    { name: 'Tosca', hex: '#77b59b', isAvailable: true },
    { name: 'Biru Muda', hex: '#5cd0ea', isAvailable: true },
    { name: 'Biru Tua', hex: '#0955a0', isAvailable: true },
    { name: 'Abu Abu', hex: '#6c6f79', isAvailable: true },
    { name: 'Coklat', hex: '#633114', isAvailable: true },
    { name: 'Hitam', hex: '#110d0c', isAvailable: true }
];

// State
let selectedBodyColor = colors.find(c => c.name === 'Biru Tua');
let selectedFlapColor = colors.find(c => c.name === 'Orange');
let selectedStrapColor = strapColors.find(c => c.name === 'Orange');

// --- Full Page Blocker Loader ---
function showBlockerLoader(message = 'Mengecek tiket...') {
    let blocker = document.getElementById('blockerLoader');
    if (!blocker) {
        blocker = document.createElement('div');
        blocker.id = 'blockerLoader';
        blocker.innerHTML = `
            <div class="blocker-content">
                <div class="blocker-spinner"></div>
                <p id="blockerMessage">${message}</p>
            </div>
        `;
        document.body.appendChild(blocker);
    } else {
        document.getElementById('blockerMessage').textContent = message;
    }
    blocker.classList.add('visible');
}

function hideBlockerLoader() {
    const blocker = document.getElementById('blockerLoader');
    if (blocker) blocker.classList.remove('visible');
}

function showBlockerError(message = 'Sistem sedang dalam gangguan. Silakan coba beberapa saat lagi.') {
    const blocker = document.getElementById('blockerLoader');
    if (blocker) {
        blocker.innerHTML = `
            <div class="blocker-content blocker-error">
                <i data-lucide="alert-triangle" style="width:48px;height:48px;color:#ef4444;"></i>
                <p>${message}</p>
                <button onclick="fetchSlotAvailability()" class="blocker-retry-btn">Coba Lagi</button>
            </div>
        `;
        lucide.createIcons();
    }
}

// DOM Elements
const bodyColorGrid = document.getElementById('bodyColorGrid');
const flapColorGrid = document.getElementById('flapColorGrid');
const strapColorGrid = document.getElementById('strapColorGrid');
const badgeBody = document.getElementById('badgeBody');
const badgeFlap = document.getElementById('badgeFlap');
const badgeStrap = document.getElementById('badgeStrap');
const inputColorBody = document.getElementById('inputColorBody');
const inputColorFlap = document.getElementById('inputColorFlap');
const inputColorStrap = document.getElementById('inputColorStrap');
const sessionSelected = document.getElementById('sessionSelected');
const submitBtn = document.getElementById('submitBtn');
const urgencyBadge = document.getElementById('urgencyBadge');
const urgencyText = document.getElementById('urgencyText');

// SUPABASE_URL/SUPABASE_ANON_KEY dari env.js
// (Cek kuota/sesi buka sekarang ditangani loadOpenBatches() di atas --
// dipanggil langsung pas file ini load, ganti checkQuota()/runQuotaWhenReady() lama.)

// --- Initialize Color Pickers ---
function renderColorPickers() {
    colors.forEach(color => {
        // Body Pickers
        const btnBody = document.createElement('button');
        btnBody.type = 'button';
        btnBody.className = `color-btn ${color.name === selectedBodyColor.name ? 'active' : ''}${!color.isAvailable ? ' disabled' : ''}`;
        btnBody.style.backgroundColor = color.hex;
        btnBody.dataset.color = color.hex;
        btnBody.dataset.name = color.name;
        btnBody.title = color.isAvailable ? color.name : `${color.name} (Habis)`;
        if (color.isAvailable) {
            btnBody.onclick = () => selectColor('body', color, btnBody);
        } else {
            btnBody.disabled = true;
        }
        bodyColorGrid.appendChild(btnBody);

        // Flap Pickers
        const btnFlap = document.createElement('button');
        btnFlap.type = 'button';
        btnFlap.className = `color-btn ${color.name === selectedFlapColor.name ? 'active' : ''}${!color.isAvailable ? ' disabled' : ''}`;
        btnFlap.style.backgroundColor = color.hex;
        btnFlap.dataset.color = color.hex;
        btnFlap.dataset.name = color.name;
        btnFlap.title = color.isAvailable ? color.name : `${color.name} (Habis)`;
        if (color.isAvailable) {
            btnFlap.onclick = () => selectColor('flap', color, btnFlap);
        } else {
            btnFlap.disabled = true;
        }
        flapColorGrid.appendChild(btnFlap);
    });

    strapColors.forEach(color => {
        // Strap Pickers
        const btnStrap = document.createElement('button');
        btnStrap.type = 'button';
        btnStrap.className = `color-btn ${color.name === selectedStrapColor.name ? 'active' : ''}${!color.isAvailable ? ' disabled' : ''}`;
        btnStrap.style.backgroundColor = color.hex;
        btnStrap.dataset.color = color.hex;
        btnStrap.dataset.name = color.name;
        btnStrap.title = color.isAvailable ? color.name : `${color.name} (Habis)`;
        if (color.isAvailable) {
            btnStrap.onclick = () => selectColor('strap', color, btnStrap);
        } else {
            btnStrap.disabled = true;
        }
        strapColorGrid.appendChild(btnStrap);
    });
}

function selectColor(type, color, btnElement) {
    if (type === 'body') {
        selectedBodyColor = color;
        document.querySelectorAll('#bodyColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        document.documentElement.style.setProperty('--j-body-color', color.hex);
        badgeBody.textContent = `Cover: ${color.name}`;
        inputColorBody.value = color.name;

    } else if (type === 'flap') {
        selectedFlapColor = color;
        document.querySelectorAll('#flapColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        document.documentElement.style.setProperty('--j-flap-color', color.hex);
        badgeFlap.textContent = `Flap: ${color.name}`;
        inputColorFlap.value = color.name;
    } else if (type === 'strap') {
        selectedStrapColor = color;
        document.querySelectorAll('#strapColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        document.documentElement.style.setProperty('--j-strap-color', color.hex);
        badgeStrap.textContent = `Tali: ${color.name}`;
        inputColorStrap.value = color.name;
    }
}

// --- Image Upload Handlers ---
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

function setupImageUpload(inputId, previewBoxId, previewImgId, base64Id, mimeId) {
    const input = document.getElementById(inputId);
    const previewBox = document.getElementById(previewBoxId);
    const previewImg = document.getElementById(previewImgId);
    const base64Input = document.getElementById(base64Id);
    const mimeInput = document.getElementById(mimeId);

    input.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("Ukuran gambar terlalu besar! Maksimal 5MB.");
            input.value = "";
            return;
        }

        try {
            const compressedDataUrl = await compressImage(file, 800, 0.7);
            previewImg.src = compressedDataUrl;
            previewBox.classList.add('has-image');
            
            base64Input.value = compressedDataUrl.split(',')[1];
            mimeInput.value = 'image/jpeg';
        } catch (error) {
            alert("Gagal memproses gambar.");
        }
    });
}

// --- Copy to Clipboard ---
document.getElementById('copyBtn').addEventListener('click', () => {
    const accountNo = document.getElementById('accountNumber').textContent;
    navigator.clipboard.writeText(accountNo).then(() => {
        showToast("Berhasil disalin");
        const icon = document.querySelector('#copyBtn i');
        const originalIcon = icon.getAttribute('data-lucide');
        icon.setAttribute('data-lucide', 'check');
        icon.style.color = 'var(--success-color)';
        lucide.createIcons();

        setTimeout(() => {
            icon.setAttribute('data-lucide', originalIcon);
            icon.style.color = '';
            lucide.createIcons();
        }, 2000);
    });
});

// --- Front Cover Word Validation ---
function validateFrontCoverWord() {
    const inputEl = document.getElementById('frontCoverWord');
    if (!inputEl) return true;
    const val = inputEl.value.trim();
    if (!val) return true;
    const wordCount = val.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > 2) {
        showToast('Front Cover Word maksimal 2 kata. Contoh: "Hello World"');
        inputEl.focus();
        return false;
    }
    return true;
}

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

    if (!validateFrontCoverWord()) return;

    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Mengirim Data...</span>';
    submitBtn.disabled = true;
    lucide.createIcons();
    statusMessage.className = 'status-message';
    statusMessage.style.display = 'none';

    showBlockerLoader("Mengirim data pendaftaran...");

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Set workshopType/batchId for routing -- batchId ngasih tau server SESI
    // mana yang dipilih (bisa ada 2+ sesi buka bareng).
    payload.workshopType = 'paper-journal';
    payload.batchId = _selectedBatchId || '';

    // --- Re-cek slot sebelum submit (sesi yang DIPILIH, bukan total tipe) ---
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

    // --- Kirim data ke Google Apps Script via POST JSON ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
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
                workshop: 'paper-journal',
                colorBody: selectedBodyColor.name,
                colorFlap: selectedFlapColor.name,
                colorStrap: selectedStrapColor.name,
                colorBodyHex: selectedBodyColor.hex,
                colorFlapHex: selectedFlapColor.hex,
                colorStrapHex: selectedStrapColor.hex,
            });
            if (new URLSearchParams(location.search).get('from') === 'member') params.set('from', 'member');

            window.location.href = '../success.html?' + params.toString();

        } else {
            throw new Error(result.message || "Unknown error occurred.");
        }

        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        lucide.createIcons();

    } catch (error) {
        statusMessage.textContent = (error.name === 'AbortError')
            ? "Koneksi timeout. Data mungkin belum terkirim — cek internetmu lalu coba lagi. Kalau tetap gagal, hubungi admin ya."
            : ("Terjadi kesalahan koneksi atau upload: " + error.message);
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

// Init
renderColorPickers();
setupImageUpload('charmPhoto', 'charmUploadArea', 'charmPreview', 'charmBase64', 'charmMimeType');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview', 'paymentBase64', 'paymentMimeType');


// (AUTO-UPDATE saat config server datang sekarang ditangani listener
// 'workshops:updated' di dekat loadOpenBatches() di atas.)
