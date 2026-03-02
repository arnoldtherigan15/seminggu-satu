// Data Warna dari User (Cover & Tutup)
// Urutan UX: Netral → Hangat → Dingin → Gelap
const colors = [
    { name: 'Putih Tulang', hex: '#e6e3da' },
    { name: 'Beige Krem', hex: '#bbb6ad' },
    { name: 'Coklat Muda', hex: '#c1a88a' },
    { name: 'Kuning Muda', hex: '#e7dd5e' },
    { name: 'Kuning', hex: '#dccf43' },
    { name: 'Orange', hex: '#e94630' },
    { name: 'Merah', hex: '#d7181e' },
    { name: 'Pink Muda', hex: '#e4b9c8' },
    { name: 'Pink Tua', hex: '#d9417e' },
    { name: 'Ungu Muda', hex: '#827cba' },
    { name: 'Ungu Tua', hex: '#7e4da5' },
    { name: 'Biru Pastel', hex: '#7dc9f0' },
    { name: 'Biru Tua', hex: '#0955a0' },
    { name: 'Mint', hex: '#8ebc9f' },
    { name: 'Hijau Pastel', hex: '#aecdbb' },
    { name: 'Hijau Tua', hex: '#0c5c3c' },
    { name: 'Coklat', hex: '#764432' },
    { name: 'Hitam', hex: '#2f2f31' }
];

// Data Warna Khusus Tali
// Urutan UX: Netral → Hangat → Dingin → Gelap
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
    { name: 'Hitam', hex: '#110d0c' }
];

// State
let selectedBodyColor = colors.find(c => c.name === 'Biru Tua');
let selectedFlapColor = colors.find(c => c.name === 'Orange');
let selectedStrapColor = strapColors.find(c => c.name === 'Orange');

// --- Full Page Blocker Loader ---
function showBlockerLoader(message = 'Mengecek slot...') {
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
                <button onclick="location.reload()" class="blocker-retry-btn">Coba Lagi</button>
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

// Variable global kuota
let slotData = { slotSesi1: 0, slotSesi2: 0 };

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby15KFek-hG5mn-xphT0N6wCyT7zXVwurXZ4tIh1y1QWqxmlTbeGLwjfmrKGEA6wOe5RA/exec';

// --- UI Toast Alert function ---
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

// --- Helper: Fetch JSONP untuk menghindari CORS Block ---
function fetchJSONP(url, callbackName) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            reject(new Error("Request timeout"));
            delete window[callbackName];
            script.remove();
        }, 8000);

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

// --- Fetch Kuota Sesi ke GAS Endpoint (JSONP Method) ---
async function fetchSlotAvailability() {
    showBlockerLoader('Sedang mengecek ketersediaan slot...');

    try {
        const result = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handleQuotaCallback');
        slotData = result;

        sessionSelected.innerHTML = '';

        let initialSelect = "";

        // Cek Kuota Sesi 1
        const opt1 = document.createElement('option');
        opt1.value = "Sabtu, 28 March 2026";
        if (result.slotSesi1 <= 0) {
            opt1.disabled = true;
            opt1.text = "Sabtu, 28 March 2026 (Penuh)";
        } else {
            opt1.text = `Sabtu, 28 March 2026`;
            if (!initialSelect) initialSelect = opt1.value;
        }
        sessionSelected.appendChild(opt1);

        // Cek Kuota Sesi 2
        const opt2 = document.createElement('option');
        opt2.value = "Minggu, 29 March 2026";
        if (result.slotSesi2 <= 0) {
            opt2.disabled = true;
            opt2.text = "Minggu, 29 March 2026 (Penuh)";
        } else {
            opt2.text = `Minggu, 29 March 2026`;
            if (!initialSelect) initialSelect = opt2.value;
        }
        sessionSelected.appendChild(opt2);

        // Auto select available session
        if (initialSelect) {
            sessionSelected.value = initialSelect;
            submitBtn.disabled = false;
        } else {
            sessionSelected.innerHTML = '<option value="" disabled selected>Semua sesi Penuh</option>';
            submitBtn.innerHTML = '<i data-lucide="x-circle"></i> <span>Form Saat Ini Ditutup</span>';
            submitBtn.disabled = true;
            lucide.createIcons();
        }

        updateUrgencyBadge();
        hideBlockerLoader();

    } catch (error) {
        console.error("Gagal mengambil ketersediaan slot", error);
        showBlockerError('Sistem sedang dalam gangguan. Silakan coba beberapa saat lagi.');
    }
}

// Logic update badge jika input diganti
function updateUrgencyBadge() {
    const val = sessionSelected.value;
    let sisa = 0;
    if (val === "Sabtu, 28 March 2026") {
        sisa = slotData.slotSesi1;
    } else if (val === "Minggu, 29 March 2026") {
        sisa = slotData.slotSesi2;
    }

    if (sisa > 0) {
        urgencyBadge.classList.add('show');
        urgencyText.textContent = `Sisa ${sisa} Tiket!`;
    } else {
        urgencyBadge.classList.remove('show');
    }
}
sessionSelected.addEventListener('change', updateUrgencyBadge);

window.addEventListener('load', fetchSlotAvailability);

// --- Initialize Color Pickers ---
function renderColorPickers() {
    colors.forEach(color => {
        // Body Pickers
        const btnBody = document.createElement('button');
        btnBody.type = 'button';
        btnBody.className = `color-btn ${color.name === selectedBodyColor.name ? 'active' : ''}`;
        btnBody.style.backgroundColor = color.hex;
        btnBody.dataset.color = color.hex;
        btnBody.dataset.name = color.name;
        btnBody.title = color.name;
        btnBody.onclick = () => selectColor('body', color, btnBody);
        bodyColorGrid.appendChild(btnBody);

        // Flap Pickers
        const btnFlap = document.createElement('button');
        btnFlap.type = 'button';
        btnFlap.className = `color-btn ${color.name === selectedFlapColor.name ? 'active' : ''}`;
        btnFlap.style.backgroundColor = color.hex;
        btnFlap.dataset.color = color.hex;
        btnFlap.dataset.name = color.name;
        btnFlap.title = color.name;
        btnFlap.onclick = () => selectColor('flap', color, btnFlap);
        flapColorGrid.appendChild(btnFlap);
    });

    strapColors.forEach(color => {
        // Strap Pickers
        const btnStrap = document.createElement('button');
        btnStrap.type = 'button';
        btnStrap.className = `color-btn ${color.name === selectedStrapColor.name ? 'active' : ''}`;
        btnStrap.style.backgroundColor = color.hex;
        btnStrap.dataset.color = color.hex;
        btnStrap.dataset.name = color.name;
        btnStrap.title = color.name;
        btnStrap.onclick = () => selectColor('strap', color, btnStrap);
        strapColorGrid.appendChild(btnStrap);
    });
}

function selectColor(type, color, btnElement) {
    if (type === 'body') {
        selectedBodyColor = color;
        // Update UI Active State
        document.querySelectorAll('#bodyColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        // Update CSS Variable
        document.documentElement.style.setProperty('--j-body-color', color.hex);
        // Update Badge & Input
        badgeBody.textContent = `Cover: ${color.name}`;
        inputColorBody.value = color.name;

    } else if (type === 'flap') {
        selectedFlapColor = color;
        // Update UI Active State
        document.querySelectorAll('#flapColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        // Update CSS Variable
        document.documentElement.style.setProperty('--j-flap-color', color.hex);
        // Update Badge & Input
        badgeFlap.textContent = `Flap: ${color.name}`;
        inputColorFlap.value = color.name;
    } else if (type === 'strap') {
        selectedStrapColor = color;
        // Update UI Active State
        document.querySelectorAll('#strapColorGrid .color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        // Update CSS Variable
        document.documentElement.style.setProperty('--j-strap-color', color.hex);
        // Update Badge & Input
        badgeStrap.textContent = `Tali: ${color.name}`;
        inputColorStrap.value = color.name;
    }
}

// --- Image Upload Handlers ---
function setupImageUpload(inputId, previewBoxId, previewImgId, base64Id, mimeId) {
    const input = document.getElementById(inputId);
    const previewBox = document.getElementById(previewBoxId);
    const previewImg = document.getElementById(previewImgId);
    const base64Input = document.getElementById(base64Id);
    const mimeInput = document.getElementById(mimeId);

    input.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi ukuran (misal maks 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("Ukuran gambar terlalu besar! Maksimal 5MB.");
            input.value = "";
            return;
        }

        // Preview Image
        const reader = new FileReader();
        reader.onload = function (event) {
            previewImg.src = event.target.result;
            previewBox.classList.add('has-image');

            // Extract Base64 without data URI prefix for Google Apps Script processing later
            const base64String = event.target.result.split(',')[1];
            base64Input.value = base64String;
            mimeInput.value = file.type;
        };
        reader.readAsDataURL(file);
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
    if (!val) return true; // not required if empty, handled by 'required' attr
    const wordCount = val.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > 2) {
        showToast('Front Cover Word maksimal 2 kata. Contoh: "Hello World"');
        inputEl.focus();
        return false;
    }
    return true;
}

// --- Form Submission (Prepare for GAS API) ---
const form = document.getElementById('workshopForm');
const statusMessage = document.getElementById('statusMessage');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Pastikan sesi sudah dipilih
    if (!sessionSelected.value) {
        showToast("Mohon pilih ketersediaan sesi terlebih dahulu!");
        return;
    }

    // Validasi Front Cover Word
    if (!validateFrontCoverWord()) return;

    // Ganti teks button
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Mengirim Data...</span>';
    submitBtn.disabled = true;
    lucide.createIcons();
    statusMessage.className = 'status-message';
    statusMessage.style.display = 'none';

    // Ambil Data
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // --- Re-cek slot sebelum submit ---
    try {
        showBlockerLoader('Mengecek ketersediaan slot...');
        const slotCheck = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handlePreSubmitCallback');
        const selectedVal = sessionSelected.value;
        const isSesi1 = selectedVal.includes('28 March');
        const availableSlot = isSesi1 ? slotCheck.slotSesi1 : slotCheck.slotSesi2;
        hideBlockerLoader();

        if (availableSlot <= 0) {
            window.location.href = 'soldout.html';
            return;
        }
    } catch (err) {
        hideBlockerLoader();
        // Jika gagal cek slot, tetap lanjut agar user tidak terhambang
        console.warn('Slot re-check failed, continuing submit:', err);
    }

    // --- Kirim data ke Google Apps Script via POST JSON ---
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Kumpulkan data untuk success page
            const selectedBodyColor = colors.find(c => c.hex === payload.colorBody);
            const selectedFlapColor = colors.find(c => c.hex === payload.colorFlap);
            const selectedStrapColor = strapColors.find(c => c.hex === payload.colorStrap);

            const params = new URLSearchParams({
                name: payload.fullName || 'Peserta',
                session: payload.sessionSelected || '-',
                colorBody: selectedBodyColor ? selectedBodyColor.name : payload.colorBody,
                colorFlap: selectedFlapColor ? selectedFlapColor.name : payload.colorFlap,
                colorStrap: selectedStrapColor ? selectedStrapColor.name : payload.colorStrap,
                colorBodyHex: payload.colorBody || '#ccc',
                colorFlapHex: payload.colorFlap || '#ccc',
                colorStrapHex: payload.colorStrap || '#ccc',
            });

            window.location.href = 'success.html?' + params.toString();
        } else {
            throw new Error(result.message || "Unknown error occurred.");
        }

        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        lucide.createIcons();

    } catch (error) {
        statusMessage.textContent = "Terjadi kesalahan koneksi atau upload: " + error.message;
        statusMessage.className = 'status-message error';
        statusMessage.style.display = 'block';
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        lucide.createIcons();
    }
});

// Init
renderColorPickers();
setupImageUpload('charmPhoto', 'charmUploadArea', 'charmPreview', 'charmBase64', 'charmMimeType');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview', 'paymentBase64', 'paymentMimeType');
