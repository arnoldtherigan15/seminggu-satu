// ============================================================
//  Pull & Pop Bookmark Workshop — Registration Logic
//  (Seminggu Satu by Arnold)
// ============================================================

const _workshopData = getWorkshopById("bookmark-journal");
const _currentPrice = getCurrentPrice(_workshopData);

document.getElementById('currentPriceEl').textContent = formatRupiah(_currentPrice);
document.getElementById('paymentAmount').textContent = formatRupiah(_currentPrice);
document.getElementById('workshopDateText').textContent = _workshopData.workshopDate;
document.getElementById('workshopTimeText').textContent = _workshopData.workshopTime;
document.getElementById('locationNameText').textContent = _workshopData.locationName;
document.getElementById('locationMapsLink').href = _workshopData.mapsLink;

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

function showBlockerLoader(message = 'Mengecek slot...') {
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
        const currentCount = counts['bookmark-journal'] || 0;
        const maxQuota = _workshopData.maxQuota || 9;
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
checkQuota();

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

    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Mengirim Data...</span>';
    submitBtn.disabled = true;
    lucide.createIcons();
    statusMessage.className = 'status-message';
    statusMessage.style.display = 'none';

    showBlockerLoader("Mengirim data pendaftaran...");

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.workshopType = 'bookmark-journal';

    try {
        const counts = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handlePreSubmit');
        const currentCount = counts['bookmark-journal'] || 0;
        const maxQuota = _workshopData.maxQuota || 9;

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

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            const params = new URLSearchParams({
                name: payload.fullName || 'Peserta',
                workshop: 'bookmark-journal',
                colorPita: selectedPitaColor.name,
                colorRantai: selectedRantaiColor.name,
                pitaBase: selectedPitaColor.base,
                pitaPattern: selectedPitaColor.pattern,
                rantaiHex: selectedRantaiColor.hex
            });

            window.location.href = '../success.html?' + params.toString();
        } else {
            throw new Error(result.message || "Unknown error occurred.");
        }
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
setupImageUpload('photo1', 'photo1UploadArea', 'photo1Preview', 'photo1Base64', 'photo1MimeType');
setupImageUpload('photo2', 'photo2UploadArea', 'photo2Preview', 'photo2Base64', 'photo2MimeType');
setupImageUpload('photo3', 'photo3UploadArea', 'photo3Preview', 'photo3Base64', 'photo3MimeType');
setupImageUpload('photo4', 'photo4UploadArea', 'photo4Preview', 'photo4Base64', 'photo4MimeType');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview', 'paymentBase64', 'paymentMimeType');
