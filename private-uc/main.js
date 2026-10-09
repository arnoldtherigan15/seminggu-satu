// ============================================================
//  Upcycle Journal Private Session — Registration Logic
//  (Seminggu Satu by Arnold)
//  Dikloning dari reka-rekat/main.js -- mekanisme upload foto/HEIC/kompres/
//  batch/payment-nya sama persis, cuma TANPA card-preview visualizer
//  (itu khusus bentuk fisik produk Reka Rekat) & TANPA field Instagram.
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
let _workshopData = getWorkshopById("private-uc"); // fallback rekening bank & isPrintPhoto (tetap type-level)
let _openBatches = [];
let _selectedBatchId = null;

// Direct-link ke sesi tertentu, mis. ?vol=2 atau ?batch=Batch%202
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

// --- Pilihan Buku Journal A6 (warna cover + tipe notebook) -- pure
// preference juga, sama pola kayak strap color di bawah.
const bookColors = [
    { name: 'Toska', hex: '#02bbe0' },
    { name: 'Biru Langit', hex: '#0281e1' },
    { name: 'Maroon', hex: '#af2e31' },
    { name: 'Abu Tua', hex: '#707270' },
    { name: 'Jingga', hex: '#fe8b30' },
    { name: 'Hijau Tua', hex: '#147242' },
    { name: 'Fusia', hex: '#fe0d88' },
    { name: 'Ungu', hex: '#4904a3' },
    { name: 'Lavender', hex: '#a27de2' },
    { name: 'Kunyit', hex: '#f4b004' },
    { name: 'Kuning', hex: '#f8e407' },
    { name: 'Jambon', hex: '#f29b94' },
];
let selectedBookColor = bookColors[0];

function renderBookColors() {
    const grid = document.getElementById('bookColorGrid');
    const input = document.getElementById('inputBookColor');
    if (!grid) return;
    grid.innerHTML = '';
    bookColors.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-btn ${color.name === selectedBookColor.name ? 'active' : ''}`;
        btn.style.backgroundColor = color.hex;
        btn.title = color.name;
        btn.onclick = () => {
            selectedBookColor = color;
            grid.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (input) input.value = color.name;
        };
        grid.appendChild(btn);
    });
    if (input) input.value = selectedBookColor.name;
}

const bookTypes = ['Dotted', 'Polos', 'Grid'];
let selectedBookType = bookTypes[0];

function renderBookTypes() {
    const grid = document.getElementById('bookTypeGrid');
    const input = document.getElementById('inputBookType');
    if (!grid) return;
    grid.innerHTML = '';
    bookTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `type-btn ${type === selectedBookType ? 'active' : ''}`;
        btn.textContent = type;
        btn.onclick = () => {
            selectedBookType = type;
            grid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (input) input.value = type;
        };
        grid.appendChild(btn);
    });
    if (input) input.value = selectedBookType;
}

// --- Kotak Susu 1L: punya sendiri atau perlu dibawain admin (pilihan biner,
// pola sama persis kayak renderBookTypes di atas, cuma 2 opsi). ---
const cartonChoices = [
    { value: 'yes', label: 'Punya, bawa sendiri' },
    { value: 'no', label: 'Tidak punya, tolong bawain' },
];
let selectedCartonChoice = cartonChoices[0];

function renderCartonChoice() {
    const grid = document.getElementById('cartonChoiceGrid');
    const input = document.getElementById('inputHasOwnCarton');
    if (!grid) return;
    grid.innerHTML = '';
    cartonChoices.forEach(choice => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `type-btn ${choice.value === selectedCartonChoice.value ? 'active' : ''}`;
        btn.textContent = choice.label;
        btn.onclick = () => {
            selectedCartonChoice = choice;
            grid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (input) input.value = choice.value;
        };
        grid.appendChild(btn);
    });
    if (input) input.value = selectedCartonChoice.value;
}
renderBookColors();
renderBookTypes();
renderCartonChoice();

// --- Pilihan Warna Tali (Closure) -- sama persis data & cara pilihnya kayak
// upcycle-journal (pure preference, nggak ada stok/takenBags buat warna tali).
const strapColors = [
    { name: 'Putih', hex: '#ebe5e5' },
    { name: 'Cream', hex: '#cfac8c' },
    { name: 'Kuning', hex: '#fde355' },
    { name: 'Stabilo', hex: '#9dde6d' },
    { name: 'Orange', hex: '#f05e37' },
    { name: 'Merah', hex: '#b71c2c' },
    { name: 'Pink', hex: '#f3c3b9' },
    { name: 'Pink Magenta', hex: '#b65179' },
    { name: 'Ungu', hex: '#692f4a' },
    { name: 'Hijau', hex: '#97ab52' },
    { name: 'Tosca', hex: '#77b59b' },
    { name: 'Biru Muda', hex: '#5cd0ea' },
    { name: 'Biru Tua', hex: '#0955a0' },
    { name: 'Abu Abu', hex: '#6c6f79' },
    { name: 'Coklat', hex: '#633114' },
    { name: 'Hitam', hex: '#110d0c' },
];
let selectedStrapColor = strapColors.find(c => c.name === 'Orange');

function renderStrapColors() {
    const grid = document.getElementById('strapColorGrid');
    const input = document.getElementById('inputColorStrap');
    if (!grid) return;
    grid.innerHTML = '';
    strapColors.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-btn ${color.name === selectedStrapColor.name ? 'active' : ''}`;
        btn.style.backgroundColor = color.hex;
        btn.title = color.name;
        btn.onclick = () => {
            selectedStrapColor = color;
            grid.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (input) input.value = color.name;
        };
        grid.appendChild(btn);
    });
}
renderStrapColors();

// Nampilin/kunci section foto berdasarkan config -- dipanggil di load AWAL *dan* tiap
// config server datang (listener 'workshops:updated' di bawah).
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
    const visibleBatches = _openBatches.filter(function (b) { return !b.hideFromPicker; });
    if (visibleBatches.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = '<p style="font-size:0.85rem;font-weight:600;margin:0 0 8px;">Pilih sesi:</p>' +
        visibleBatches.map(function (b) {
            return '<div class="batch-opt" data-batch="' + b.id + '" style="border:2px solid ' + (b.id === _selectedBatchId ? 'var(--brand,#5e72e4)' : '#e5e7eb') + ';border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;">' +
                '<div style="font-weight:700;">' + (b.label || 'Sesi') + '</div>' +
                '<div style="font-size:0.82rem;color:#6b7280;">' + (b.displayDate || '-') + (b.workshopTime ? ' · ' + b.workshopTime : '') + ' — sisa ' + (b.remaining == null ? '?' : b.remaining) + ' tiket</div></div>';
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
    // Toggle picker Tipe/Warna Journal & Warna Tali -- per BATCH (bukan
    // per-tipe/Config), dipake admin pas journal-nya udah fix/dipaketin buat
    // batch tertentu aja. `required` juga harus ikut dilepas pas disembunyiin,
    // soalnya browser nolak submit form yang punya required field yang
    // nggak focusable (display:none).
    const showJournal = b.showJournalPicker !== false;
    const journalSection = document.getElementById('journalPickersSection');
    if (journalSection) journalSection.style.display = showJournal ? '' : 'none';
    ['inputBookColor', 'inputBookType', 'inputColorStrap'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.required = showJournal;
    });
    // Rekening pembayaran -- tetap type-level (kerja sama pihak ketiga bisa
    // beda rekening per WORKSHOP, tapi ga masuk akal beda per batch/sesi).
    const w = _workshopData;
    document.getElementById('bankNameText').textContent = (w && w.bankName) || 'BCA';
    document.getElementById('accountNumber').textContent = (w && w.bankAccountNumber) || '6042825961';
    document.getElementById('bankOwnerText').textContent = 'a.n ' + ((w && w.bankAccountHolder) || 'Arnold Therigan');
    // Badge "Sisa X Tiket!" HARUS ikut update tiap ganti sesi di batch picker --
    // sebelumnya cuma di-set SEKALI di loadOpenBatches() pas load awal, jadi
    // begitu user klik batch LAIN di "Pilih sesi" (mis. dari Batch 1 ke Batch
    // 2), badge-nya nyangkut kepake sisa tiket Batch 1 terus (BUG NYATA:
    // Batch 2/3 yang remaining-nya beda tetap kepampang angka Batch 1).
    if (urgencyBadge && urgencyText) {
        urgencyBadge.classList.add('show');
        const left = b.remaining;
        urgencyText.textContent = left == null ? 'Tiket tersedia' : `Sisa ${left} Tiket!`;
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

// Ambil daftar sesi yang lagi buka. Dipanggil pas load & pas config
// server ke-refresh ('workshops:updated').
async function loadOpenBatches() {
    showBlockerLoader('Mengecek ketersediaan tiket...');
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/workshop-batches`, { headers: { apikey: SUPABASE_ANON_KEY }, signal: controller.signal });
        clearTimeout(timer);
        const all = await res.json();
        _openBatches = (all && all['private-uc']) || [];
    } catch (err) {
        console.error('Cek sesi gagal:', err);
        hideBlockerLoader();
        return; // fail-open -- server tetap validasi ulang pas submit
    }
    hideBlockerLoader();
    const visible = _openBatches.filter(function (b) { return !b.hideFromPicker; });
    const queried = matchBatchFromQuery();
    // Kalau nggak ada batch yang VISIBLE DAN nggak ada link langsung yang
    // cocok, anggap "abis" -- JANGAN otomatis jatuh ke batch yang di-hide.
    if (!_openBatches.length || (!visible.length && !queried)) {
        window.location.replace('../closed.html?workshop=private-uc&reason=sold-out');
        return;
    }
    if (!_selectedBatchId || !_openBatches.find(function (b) { return b.id === _selectedBatchId; })) {
        _selectedBatchId = queried || visible[0].id;
    }
    renderBatchPicker();
    applyBatchDisplay();
}
loadOpenBatches();

// --- Image Compression ---
// HEIC (foto iPhone) nggak bisa didecode browser di banyak kombinasi
// device/OS -- konversi ke JPEG dulu kalau ketauan HEIC (heic2any dimuat
// on-demand dari CDN, cuma pas ketemu file HEIC beneran).
function isHeicFile(f) {
    return /heic|heif/i.test((f && f.type) || '') || /\.(heic|heif)$/i.test((f && f.name) || '');
}
async function heicToJpeg(file) {
    if (!window.heic2any) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
            s.onload = res; s.onerror = () => rej(new Error('Gagal memuat konverter HEIC.'));
            document.head.appendChild(s);
        });
    }
    const out = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    return Array.isArray(out) ? out[0] : out;
}

async function compressImage(file, maxSize, quality) {
    if (isHeicFile(file)) file = await heicToJpeg(file);
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
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
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal memuat gambar buat dikompres -- coba pilih ulang fotonya.")); };
        img.src = url;
    });
}

async function fileToBase64(file) {
    try {
        if (isHeicFile(file)) file = await heicToJpeg(file);
    } catch (e) { /* gagal convert HEIC -- coba baca file asli aja */ }
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
        const compressedDataUrl = await withTimeout(compressImage(file, 800, 0.7), 20000, 'Kompres gambar');
        return compressedDataUrl.split(',')[1];
    } catch (err) {
        console.warn("Canvas compression failed, falling back to raw base64:", err);
        return await withTimeout(fileToBase64(file), 20000, 'Baca gambar');
    }
}

const selectedFiles = {};

function setupImageUpload(inputId, previewBoxId, previewImgId) {
    const input = document.getElementById(inputId);
    const previewBox = document.getElementById(previewBoxId);
    const previewImg = document.getElementById(previewImgId);

    if (!input) return;

    input.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // Limit 20MB
        if (file.size > 20 * 1024 * 1024) {
            alert("Ukuran gambar terlalu besar! Maksimal 20MB.");
            input.value = "";
            previewBox.classList.remove('has-image');
            delete selectedFiles[inputId];
            return;
        }

        let targetBlob = file;

        if (isHeicFile(file)) {
            showBlockerLoader("Mengonversi foto HEIC ke JPEG...");
            try {
                targetBlob = await heicToJpeg(file);
            } catch (err) {
                console.error("HEIC conversion error:", err);
                alert("Gagal memproses berkas HEIC. Silakan gunakan format JPG atau PNG.");
                input.value = "";
                previewBox.classList.remove('has-image');
                delete selectedFiles[inputId];
                return;
            } finally {
                hideBlockerLoader();
            }
        }

        selectedFiles[inputId] = targetBlob;

        const objectUrl = URL.createObjectURL(targetBlob);
        previewImg.src = objectUrl;
        previewBox.classList.add('has-image');
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
    payload.workshopType = 'private-uc';
    payload.batchId = _selectedBatchId || '';
    payload.isPrintPhoto = _workshopData.isPrintPhoto;

    // Batch ini matiin picker Tipe/Warna Journal & Warna Tali -- jangan
    // kirim nilai default yang nggak pernah beneran dipilih peserta.
    const selBatchForSubmit = getSelectedBatch();
    const journalPickerShown = !selBatchForSubmit || selBatchForSubmit.showJournalPicker !== false;
    if (!journalPickerShown) {
        delete payload.bookColor;
        delete payload.bookType;
        delete payload.colorStrap;
    }

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
                workshop: 'private-uc',
                batchId: payload.batchId || '',
            });
            if (journalPickerShown) {
                params.set('bookColor', selectedBookColor.name);
                params.set('bookColorHex', selectedBookColor.hex);
                params.set('bookType', selectedBookType);
                params.set('colorStrap', selectedStrapColor.name);
                params.set('colorStrapHex', selectedStrapColor.hex);
            }
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
setupImageUpload('photo1', 'photo1UploadArea', 'photo1Preview');
setupImageUpload('photo2', 'photo2UploadArea', 'photo2Preview');
setupImageUpload('photo3', 'photo3UploadArea', 'photo3Preview');
setupImageUpload('photo4', 'photo4UploadArea', 'photo4Preview');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview');


// ============================================================
//  AUTO-UPDATE saat config server datang (biar harga/tanggal SELALU terbaru).
// ============================================================
window.addEventListener('workshops:updated', function () {
    _workshopData = getWorkshopById('private-uc');
    applyPrintPhotoConfig(_workshopData);
    loadOpenBatches();
});
