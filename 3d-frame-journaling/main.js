// ============================================================
//  3D Frame Journaling Workshop — Registration Logic
// ============================================================

// --- Google Apps Script API endpoint (MUST be before checkQuota) ---
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxyh5OcWm7Jr0e196R9bg_FUPqT58uULQfWxniIUi3wfJ9KL83GkzKDeb7OB0uzI1eaDQ/exec';

// --- Workshop Config & Pricing ---
const _workshopData = getWorkshopById("3d-frame-journaling");
const _isEarlyBird = isEarlyBird(_workshopData);
const _currentPrice = getCurrentPrice(_workshopData);

const discountPriceEl = document.getElementById('discountPriceEl');
const currentPriceEl = document.getElementById('currentPriceEl');
const paymentAmountEl = document.getElementById('paymentAmount');
const earlyBirdInfoEl = document.getElementById('earlyBirdInfo');
const earlyBirdTextEl = document.getElementById('earlyBirdText');

if (_isEarlyBird) {
    discountPriceEl.textContent = formatRupiah(_workshopData.normalPrice);
    discountPriceEl.style.display = '';
    currentPriceEl.textContent = formatRupiah(_workshopData.earlyBirdPrice);
    currentPriceEl.className = 'new-price';
    earlyBirdInfoEl.style.display = 'flex';
    earlyBirdTextEl.textContent = `Harga Early Bird sampai ${formatDateIndo(_workshopData.earlyBirdDueDate)}`;
} else {
    discountPriceEl.style.display = 'none';
    currentPriceEl.textContent = formatRupiah(_workshopData.normalPrice);
    currentPriceEl.className = 'new-price';
    currentPriceEl.style.color = 'var(--text-primary)';
    currentPriceEl.style.animation = 'none';
}

paymentAmountEl.textContent = formatRupiah(_currentPrice);

// --- Populate Dynamic Workshop Info ---
document.getElementById('workshopDateText').textContent = _workshopData.workshopDate;
document.getElementById('workshopTimeText').textContent = _workshopData.workshopTime;
document.getElementById('locationNameText').textContent = _workshopData.locationName;
document.getElementById('locationMapsLink').href = _workshopData.mapsLink;

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

// --- Check Quota (Sisa Tiket) ---
async function checkQuota() {
    showBlockerLoader('Mengecek ketersediaan tiket...');
    try {
        const counts = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handleQuota');
        const currentCount = counts['3d-frame-journaling'] || 0;
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

// --- Frame Selection Logic ---
const frameOptions = document.querySelectorAll('.frame-option');
const activeFrameImg = document.getElementById('activeFrameImg');
const inputSelectedFrame = document.getElementById('inputSelectedFrame');

frameOptions.forEach(option => {
    option.addEventListener('click', () => {
        frameOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        const frameId = option.getAttribute('data-frame');
        activeFrameImg.src = `../images/frame${frameId}.png`;
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
            const compressedDataUrl = await compressImage(file, 800, 0.7);

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
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
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

    // Also grab b64 photos that are outside the form (in the visualizer section)
    payload.b64Photo1 = document.getElementById('b64Photo1').value;
    payload.b64Photo2 = document.getElementById('b64Photo2').value;
    payload.b64Photo3 = document.getElementById('b64Photo3').value;
    payload.b64Photo4 = document.getElementById('b64Photo4').value;

    // --- Re-cek slot sebelum submit ---
    try {
        showBlockerLoader('Mengecek ketersediaan slot...');
        const counts = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handlePreSubmit');
        const currentCount = counts['3d-frame-journaling'] || 0;
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

    // Clean up unnecessary raw File objects since we send Base64
    delete payload.photo1;
    delete payload.photo2;
    delete payload.photo3;
    delete payload.photo4;
    delete payload.paymentPhoto;

    try {
        showBlockerLoader("Mengirim data pendaftaran...");
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Redirect to success
            const params = new URLSearchParams({
                name: payload.fullName || 'Peserta',
                workshop: '3d-frame'
            });
            window.location.href = '../success.html?' + params.toString();
        } else {
            throw new Error(result.message || "Unknown error occurred.");
        }
    } catch (error) {
        statusMessage.textContent = "Terjadi kesalahan: " + error.message;
        statusMessage.className = 'status-message error';
        statusMessage.style.display = 'block';
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        lucide.createIcons();
        hideBlockerLoader();
    }
});
