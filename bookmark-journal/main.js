// ============================================================
//  Pull & Pop Bookmark Workshop — Registration Logic
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
let _workshopData = getWorkshopById("bookmark-journal"); // fallback rekening bank dkk (tetap type-level)
let _openBatches = [];
let _selectedBatchId = null;
let _currentPrice = 0;

function getSelectedBatch() { return _openBatches.find(function (b) { return b.id === _selectedBatchId; }) || null; }

function renderBatchPicker() {
    const box = document.getElementById('batchPicker');
    if (!box) return;
    if (_openBatches.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = '<p style="font-size:0.85rem;font-weight:600;margin:0 0 8px;">Pilih sesi:</p>' +
        _openBatches.map(function (b) {
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

// Data Pita
const pitaColors = [
    { name: 'Hijau dot', base: '#4CAF50', pattern: 'radial-gradient(circle, #fff 25%, transparent 28%)', bgSize: '10px 10px' },
    { name: 'Merah dot', base: '#F44336', pattern: 'radial-gradient(circle, #fff 25%, transparent 28%)', bgSize: '10px 10px' },
    { name: 'Pink tua dot', base: '#E91E63', pattern: 'radial-gradient(circle, #fff 25%, transparent 28%)', bgSize: '10px 10px' },
    { name: 'Biru tua dot', base: '#1565C0', pattern: 'radial-gradient(circle, #fff 25%, transparent 28%)', bgSize: '10px 10px' },
    { name: 'Pink muda dot', base: '#F48FB1', pattern: 'radial-gradient(circle, #fff 25%, transparent 28%)', bgSize: '10px 10px' },
    { name: 'Orange dot', base: '#FF9800', pattern: 'radial-gradient(circle, #fff 25%, transparent 28%)', bgSize: '10px 10px' },
    { name: 'Hijau muda strip', base: '#8BC34A', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Ungu strip', base: '#9C27B0', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Biru tua strip', base: '#1565C0', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Hitam strip', base: '#212121', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Hijau tua strip', base: '#2E7D32', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Biru muda strip', base: '#03A9F4', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Merah strip', base: '#F44336', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Coklat strip', base: '#795548', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Kuning strip', base: '#FFEB3B', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Orange strip', base: '#FF9800', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' },
    { name: 'Fanta strip', base: '#FF4081', pattern: 'linear-gradient(90deg, rgba(255,255,255,0.5) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.5) 50%, transparent 50%)', bgSize: '8px 8px' }
];

// Data Rantai
const rantaiColors = [
    { name: 'Putih', hex: '#FFFFFF' },
    { name: 'Kuning', hex: '#FFEB3B' },
    { name: 'Orange', hex: '#FF9800' },
    { name: 'Pink', hex: '#E91E63' },
    { name: 'Merah', hex: '#F44336' },
    { name: 'Ungu', hex: '#9C27B0' },
    { name: 'Tosca', hex: '#009688' },
    { name: 'Biru', hex: '#2196F3' },
    { name: 'Hijau', hex: '#4CAF50' },
    { name: 'Hitam', hex: '#212121' },
    { name: 'Gold', hex: '#FFD700' },
    { name: 'Silver', hex: '#C0C0C0' }
];

let selectedPitaColor = pitaColors[0];
let selectedRantaiColor = rantaiColors[0];

// DOM Elements
const pitaColorGrid = document.getElementById('pitaColorGrid');
const rantaiColorGrid = document.getElementById('rantaiColorGrid');
const badgePita = document.getElementById('badgePita');
const badgeRantai = document.getElementById('badgeRantai');
const inputColorPita = document.getElementById('inputColorPita');
const inputColorRantai = document.getElementById('inputColorRantai');
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
        _openBatches = (all && all['bookmark-journal']) || [];
    } catch (err) {
        console.error('Cek sesi gagal:', err);
        hideBlockerLoader();
        return; // fail-open -- server tetap validasi ulang pas submit
    }
    hideBlockerLoader();
    if (!_openBatches.length) {
        window.location.replace('../closed.html?workshop=bookmark-journal&reason=sold-out');
        return;
    }
    if (!_selectedBatchId || !_openBatches.find(function (b) { return b.id === _selectedBatchId; })) {
        _selectedBatchId = _openBatches[0].id;
    }
    renderBatchPicker();
    applyBatchDisplay();
    urgencyBadge.classList.add('show');
    const left = getSelectedBatch().remaining;
    urgencyText.textContent = left == null ? 'Tiket tersedia' : `Sisa ${left} Tiket!`;
}
loadOpenBatches();

function renderColorPickers() {
    // Render Pita
    pitaColors.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-btn ${color.name === selectedPitaColor.name ? 'active' : ''}`;
        btn.style.backgroundColor = color.base;
        btn.title = color.name;
        
        const patternOverlay = document.createElement('div');
        patternOverlay.className = 'pattern-overlay';
        patternOverlay.style.backgroundImage = color.pattern;
        patternOverlay.style.backgroundSize = color.bgSize;
        btn.appendChild(patternOverlay);

        btn.onclick = () => selectColor('pita', color, btn);
        pitaColorGrid.appendChild(btn);
    });

    // Render Rantai
    rantaiColors.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-btn ${color.name === selectedRantaiColor.name ? 'active' : ''}`;
        btn.style.backgroundColor = color.hex;
        if(color.hex === '#FFFFFF') {
            btn.style.border = '1px solid #ccc';
        }
        btn.title = color.name;

        btn.onclick = () => selectColor('rantai', color, btn);
        rantaiColorGrid.appendChild(btn);
    });
    
    // Initial Trigger
    document.documentElement.style.setProperty('--pita-color', selectedPitaColor.base);
    document.documentElement.style.setProperty('--pita-pattern', selectedPitaColor.pattern);
    document.documentElement.style.setProperty('--rantai-color', selectedRantaiColor.hex);
}

function selectColor(type, color, btnElement) {
    if (type === 'pita') {
        selectedPitaColor = color;
        document.querySelectorAll('#pitaColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        document.documentElement.style.setProperty('--pita-color', color.base);
        document.documentElement.style.setProperty('--pita-pattern', color.pattern);
        badgePita.textContent = `Pita: ${color.name}`;
        inputColorPita.value = color.name;
    } else if (type === 'rantai') {
        selectedRantaiColor = color;
        document.querySelectorAll('#rantaiColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        document.documentElement.style.setProperty('--rantai-color', color.hex);
        badgeRantai.textContent = `Rantai: ${color.name}`;
        inputColorRantai.value = color.name;
    }
}

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

function setupImageUpload(inputId, previewBoxId, previewImgId, base64Id, mimeId) {
    const input = document.getElementById(inputId);
    const previewBox = document.getElementById(previewBoxId);
    const previewImg = document.getElementById(previewImgId);
    const base64Input = document.getElementById(base64Id);
    const mimeInput = document.getElementById(mimeId);

    if(!input) return;

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
        alert("Berhasil disalin");
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
    // --- Validation: ensure required fields are filled ---
    const missing = [];
    if (!form.fullName.value.trim()) missing.push('Nama Lengkap');
    if (!form.nickname.value.trim()) missing.push('Nickname');
    if (!form.whatsapp.value.trim()) missing.push('Nomor WhatsApp');
    // Check required photo uploads
    ['photo1','photo2','photo3','photo4','paymentPhoto'].forEach(id => {
        const inp = document.getElementById(id);
        if (!inp || !inp.files || inp.files.length === 0) missing.push(`Foto ${id.replace('photo','')}`);
    });
    if (missing.length) {
        alert('Harap isi semua field yang diperlukan:\n' + missing.join('\n'));
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        lucide.createIcons();
        hideBlockerLoader();
        return;
    }
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Mengirim Data...</span>';
    submitBtn.disabled = true;
    lucide.createIcons();
    statusMessage.className = 'status-message';
    statusMessage.style.display = 'none';

    showBlockerLoader("Mengirim data pendaftaran...");

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.workshopType = 'bookmark-journal';
    payload.batchId = _selectedBatchId || '';

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
                workshop: 'bookmark-journal',
                colorPita: selectedPitaColor.name,
                colorRantai: selectedRantaiColor.name,
                pitaBase: selectedPitaColor.base,
                pitaPattern: selectedPitaColor.pattern,
                rantaiHex: selectedRantaiColor.hex
            });
            if (new URLSearchParams(location.search).get('from') === 'member') params.set('from', 'member');

            window.location.href = '../success.html?' + params.toString();
        } else {
            throw new Error(result.message || "Unknown error occurred.");
        }
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
setupImageUpload('photo1', 'photo1UploadArea', 'photo1Preview', 'photo1Base64', 'photo1MimeType');
setupImageUpload('photo2', 'photo2UploadArea', 'photo2Preview', 'photo2Base64', 'photo2MimeType');
setupImageUpload('photo3', 'photo3UploadArea', 'photo3Preview', 'photo3Base64', 'photo3MimeType');
setupImageUpload('photo4', 'photo4UploadArea', 'photo4Preview', 'photo4Base64', 'photo4MimeType');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview', 'paymentBase64', 'paymentMimeType');


// ============================================================
//  AUTO-UPDATE saat config server datang (biar harga/tanggal SELALU terbaru).
// ============================================================
window.addEventListener('workshops:updated', function () {
    _workshopData = getWorkshopById('bookmark-journal');
    loadOpenBatches();
});
