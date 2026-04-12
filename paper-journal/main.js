// ============================================================
//  Paper Journal Creative Workshop — Registration Logic
//  (Seminggu Satu by Arnold)
// ============================================================

// --- Dynamic Early Bird Pricing ---
const _workshopData = getWorkshopById("paper-journal");
const _isEarlyBird = isEarlyBird(_workshopData);
const _currentPrice = getCurrentPrice(_workshopData);

// Update price display in hero
const discountPriceEl = document.getElementById('discountPriceEl');
const currentPriceEl = document.getElementById('currentPriceEl');
const paymentAmountEl = document.getElementById('paymentAmount');
const earlyBirdInfoEl = document.getElementById('earlyBirdInfo');
const earlyBirdTextEl = document.getElementById('earlyBirdText');

if (_isEarlyBird) {
    // Show: strikethrough normal + green early bird price
    discountPriceEl.textContent = formatRupiah(_workshopData.normalPrice);
    discountPriceEl.style.display = '';
    currentPriceEl.textContent = formatRupiah(_workshopData.earlyBirdPrice);
    currentPriceEl.className = 'new-price';

    // Show early bird info
    earlyBirdInfoEl.style.display = 'flex';
    earlyBirdTextEl.textContent = `Harga Early Bird sampai ${formatDateIndo(_workshopData.earlyBirdDueDate)}`;
} else {
    // Show normal price only (no discount display)
    discountPriceEl.style.display = 'none';
    currentPriceEl.textContent = formatRupiah(_workshopData.normalPrice);
    currentPriceEl.className = 'new-price';
    currentPriceEl.style.color = 'var(--text-primary)';
    currentPriceEl.style.animation = 'none';
}

// Update payment info
paymentAmountEl.textContent = formatRupiah(_currentPrice);

// --- Populate Dynamic Workshop Info ---
document.getElementById('workshopDateText').textContent = _workshopData.workshopDate;
document.getElementById('workshopTimeText').textContent = _workshopData.workshopTime;
document.getElementById('locationNameText').textContent = _workshopData.locationName;
document.getElementById('locationMapsLink').href = _workshopData.mapsLink;


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

// GOOGLE_SCRIPT_URL is loaded from env.js

// --- Helper: Fetch JSONP ---
function fetchJSONP(url, callbackPrefix) {
    return new Promise((resolve, reject) => {
        const callbackName = callbackPrefix + '_' + Date.now();
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            reject(new Error("Request timeout"));
            delete window[callbackName];
            script.remove();
        }, 15000);

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
    try {
        const counts = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handleQuota');
        const currentCount = counts['paper-journal'] || 0;
        const maxQuota = _workshopData.maxQuota || 12;
        const sisa = Math.max(0, maxQuota - currentCount);

        if (sisa <= 0) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="x-circle"></i> <span>Pendaftaran Penuh</span>';
            lucide.createIcons();
            urgencyBadge.classList.add('show');
            urgencyText.textContent = "Pendaftaran Penuh";
        } else {
            urgencyBadge.classList.add('show');
            urgencyText.textContent = `Sisa ${sisa} Tiket!`;
        }
    } catch (err) {
        console.error("Gagal mengecek kuota:", err);
    } finally {
        hideBlockerLoader();
    }
}

// Check on load
checkQuota();

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
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
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

    // Set workshopType for GAS routing
    payload.workshopType = 'paper-journal';

    // --- Re-cek slot sebelum submit ---
    try {
        showBlockerLoader('Mengecek ketersediaan slot...');
        const counts = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handlePreSubmit');
        const currentCount = counts['paper-journal'] || 0;
        const maxQuota = _workshopData.maxQuota || 12;

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
    } finally {
        hideBlockerLoader();
    }

    // --- Kirim data ke Google Apps Script via POST JSON ---
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            const params = new URLSearchParams({
                name: payload.fullName || 'Peserta',
                workshop: 'paper-journal',
                colorBody: selectedBodyColor.name,
                colorFlap: selectedFlapColor.name,
                colorStrap: selectedStrapColor.name,
                colorBodyHex: selectedBodyColor.hex,
                colorFlapHex: selectedFlapColor.hex,
                colorStrapHex: selectedStrapColor.hex,
            });

            window.location.href = '../success.html?' + params.toString();

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
    } finally {
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
