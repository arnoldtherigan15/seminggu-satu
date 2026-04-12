// ============================================================
//  Artcycle Bag Journal — Registration Logic
//  (Seminggu Satu by Arnold)
// ============================================================

// --- Dynamic Early Bird Pricing ---
const _workshopData = getWorkshopById("artcycle-journal");
const _isEarlyBird = isEarlyBird(_workshopData);
const _currentPrice = getCurrentPrice(_workshopData);

// Update price display in hero
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
}

paymentAmountEl.textContent = formatRupiah(_currentPrice);

// --- Populate Dynamic Workshop Info ---
document.getElementById('workshopDateText').textContent = _workshopData.workshopDate;
document.getElementById('workshopTimeText').textContent = _workshopData.workshopTime;
document.getElementById('locationNameText').textContent = _workshopData.locationName;
document.getElementById('locationMapsLink').href = _workshopData.mapsLink;

// ============================================================
//  Data Bag Images (Stock)
// ============================================================
// Total 42 bags, each unique
const bagIds = Array.from({ length: 42 }, (_, i) => `Bag_${i + 1}`);

// Data Warna Khusus Tali (Closure)
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
let selectedBodyBagId = null;
let selectedFlapBagId = null;
let selectedStrapColor = strapColors.find(c => c.name === 'Orange');
let takenBags = []; // Image IDs already sold out in spreadsheet

// DOM Elements
const bodyBagSlider = document.getElementById('bodyBagSlider');
const flapBagSlider = document.getElementById('flapBagSlider');
const strapColorGrid = document.getElementById('strapColorGrid');
const badgeBody = document.getElementById('badgeBody');
const badgeFlap = document.getElementById('badgeFlap');
const badgeStrap = document.getElementById('badgeStrap');
const inputBodyBagId = document.getElementById('inputBodyBagId');
const inputFlapBagId = document.getElementById('inputFlapBagId');
const inputColorStrap = document.getElementById('inputColorStrap');
const submitBtn = document.getElementById('submitBtn');
const urgencyBadge = document.getElementById('urgencyBadge');
const urgencyText = document.getElementById('urgencyText');

// ============================================================
//  NEW: Gesture / Drag-to-Scroll Logic
// ============================================================
function initDragScroll(slider) {
    let isDown = false;
    let startX;
    let scrollLeft;
    let clickStartX;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.style.scrollBehavior = 'auto'; // Disable smooth for dragging
        slider.style.scrollSnapType = 'none'; // Disable snap during drag
        startX = e.pageX - slider.offsetLeft;
        clickStartX = e.pageX;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        if (!isDown) return;
        isDown = false;
        slider.style.scrollBehavior = 'smooth';
        slider.style.scrollSnapType = 'x mandatory';
    });

    slider.addEventListener('mouseup', (e) => {
        isDown = false;
        slider.style.scrollBehavior = 'smooth';
        slider.style.scrollSnapType = 'x mandatory';
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.5; // multiplier for speed
        slider.scrollLeft = scrollLeft - walk;
    });

    // Handle blocking click if dragging occurred
    slider.addEventListener('click', (e) => {
        if (Math.abs(e.pageX - clickStartX) > 5) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }, true);
}

// --- Helper: Auto-scroll Slider ---
window.scrollSlider = (id, amount) => {
    const el = document.getElementById(id);
    if (el) el.scrollBy({ left: amount, behavior: 'smooth' });
};

// --- Full Page Blocker Loader ---
function showBlockerLoader(message = 'Mengecek ketersediaan...') {
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

// --- Helper: Fetch JSONP ---
function fetchJSONP(url, callbackPrefix) {
    return new Promise((resolve, reject) => {
        const callbackPrefixStr = callbackPrefix || 'callback';
        const callbackName = callbackPrefixStr + '_' + Date.now();
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

        script.src = `${url}?callback=${callbackName}&workshop=artcycle-journal`;
        script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Failed to load script"));
            delete window[callbackName];
            script.remove();
        };
        document.body.appendChild(script);
    });
}

async function checkStock() {
    showBlockerLoader('Mengecek ketersediaan stok bag...');
    try {
        const result = await fetchJSONP(GOOGLE_SCRIPT_URL, 'handleQuota');
        
        // Handle general quota (Uses whatever is in workshop-config.js)
        const currentCount = result['artcycle-journal'] || 0;
        const maxQuota = _workshopData.maxQuota || 12; 
        const sisa = Math.max(0, maxQuota - currentCount);

        // Handle specific taken bags from spreadsheet
        takenBags = result.takenBags || [];

        if (sisa <= 0) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="x-circle"></i> <span>Pendaftaran Penuh</span>';
            urgencyBadge.classList.add('show');
            urgencyText.textContent = "Pendaftaran Penuh";
        } else {
            urgencyBadge.classList.add('show');
            urgencyText.textContent = `Sisa ${sisa} Tiket!`;
        }

        renderBagSliders();
        renderStrapColors();
        lucide.createIcons();
    } catch (err) {
        console.error("Gagal mengecek stok:", err);
        renderBagSliders(); 
        renderStrapColors();
        lucide.createIcons();
    } finally {
        hideBlockerLoader();
    }
}

// --- Initialize Bag Sliders ---
function renderBagSliders() {
    renderSlider(bodyBagSlider, 'body');
    renderSlider(flapBagSlider, 'flap');
    
    // Init drag scroll
    if (bodyBagSlider) initDragScroll(bodyBagSlider);
    if (flapBagSlider) initDragScroll(flapBagSlider);
}

function renderSlider(container, type) {
    if (!container) return;
    container.innerHTML = '';
    
    bagIds.forEach(id => {
        const isSoldOut = takenBags.includes(id);
        
        // --- REQUEST: Hide Sold Out Items ---
        if (isSoldOut) return; 

        // Special check: if bag is currently selected for the OTHER part by this user
        const isReservedByMe = (type === 'body' && selectedFlapBagId === id) || 
                               (type === 'flap' && selectedBodyBagId === id);
        
        // Check if currently selected for THIS slider
        const isActive = (type === 'body' && selectedBodyBagId === id) || 
                         (type === 'flap' && selectedFlapBagId === id);
        
        const item = document.createElement('div');
        item.className = `bag-item ${isReservedByMe ? 'reserved' : ''} ${isActive ? 'active' : ''}`;
        
        const imgPath = `../images/shopping_bag/${id}.jpg`;
        
        item.innerHTML = `
            <div class="bag-img-wrap">
                ${isReservedByMe ? '<div class="reserved-badge">Sudah Terpilih</div>' : ''}
                <img src="${imgPath}" alt="${id}" class="bag-img" draggable="false">
            </div>
            <span class="bag-label">${id.replace('_', ' ')}</span>
        `;
        
        if (!isReservedByMe) {
            item.onclick = () => selectBag(id, type, item);
        } else {
            item.onclick = (e) => {
                e.preventDefault();
                showToast(`Bag ini sedang digunakan untuk ${type === 'body' ? 'Flap' : 'Cover'} kamu.`);
            }
        }
        
        container.appendChild(item);
    });
}

function selectBag(id, type, element) {
    if (type === 'body' && selectedFlapBagId === id) {
        showToast("Bag ini sudah kamu pilih untuk Flap.");
        return;
    }
    if (type === 'flap' && selectedBodyBagId === id) {
        showToast("Bag ini sudah kamu pilih untuk Cover.");
        return;
    }

    const imgPath = `../images/shopping_bag/${id}.jpg`;
    
    if (type === 'body') {
        selectedBodyBagId = id;
        document.querySelectorAll('#bodyBagSlider .bag-item').forEach(i => i.classList.remove('active'));
        element.classList.add('active');
        const motifBody = document.getElementById('motifBody');
        motifBody.style.backgroundImage = `url(${imgPath})`;
        badgeBody.textContent = `Cover: ${id.replace('_', ' ')}`;
        inputBodyBagId.value = id;
    } else {
        selectedFlapBagId = id;
        document.querySelectorAll('#flapBagSlider .bag-item').forEach(i => i.classList.remove('active'));
        element.classList.add('active');
        const motifFlap = document.getElementById('motifFlap');
        motifFlap.style.backgroundImage = `url(${imgPath})`;
        badgeFlap.textContent = `Flap: ${id.replace('_', ' ')}`;
        inputFlapBagId.value = id;
    }

    // Refresh sliders to update "Reserved" state for the other slider
    renderBagSliders();
}

// --- Initialize Strap Colors ---
function renderStrapColors() {
    strapColorGrid.innerHTML = '';
    strapColors.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-btn ${color.name === selectedStrapColor.name ? 'active' : ''}`;
        btn.style.backgroundColor = color.hex;
        btn.title = color.name;
        btn.onclick = () => {
            selectedStrapColor = color;
            document.querySelectorAll('#strapColorGrid .color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Apply to CSS variables and also the vertical flap-strap specifically
            document.documentElement.style.setProperty('--j-strap-color', color.hex);
            const verticalStrands = document.querySelectorAll('.flap-strap');
            verticalStrands.forEach(s => s.style.backgroundColor = color.hex);
            
            badgeStrap.textContent = `Tali: ${color.name}`;
            inputColorStrap.value = color.name;
        };
        strapColorGrid.appendChild(btn);
    });
}

// --- Image Upload Handlers ---
let isProcessingImages = 0;

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

    if (!input) return;

    input.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) {
            base64Input.value = "";
            previewBox.classList.remove('has-image');
            return;
        }

        // Reset and show loading
        base64Input.value = "";
        
        if (file.size > 5 * 1024 * 1024) {
            showToast("Ukuran gambar too large! Max 5MB.");
            input.value = "";
            previewBox.classList.remove('has-image');
            previewImg.src = "";
            return;
        }

        isProcessingImages++;
        previewBox.classList.add('loading');

        try {
            const compressedDataUrl = await compressImage(file, 800, 0.7);
            
            previewImg.src = compressedDataUrl;
            previewBox.classList.add('has-image');
            previewBox.classList.remove('loading');
            
            base64Input.value = compressedDataUrl.split(',')[1];
            mimeInput.value = 'image/jpeg';
            
            isProcessingImages = Math.max(0, isProcessingImages - 1);
        } catch (error) {
            showToast("Gagal memproses gambar.");
            isProcessingImages = Math.max(0, isProcessingImages - 1);
            previewBox.classList.remove('loading');
        }
    });
}

// --- Copy to Clipboard ---
const copyBtn = document.getElementById('copyBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const accountNo = document.getElementById('accountNumber').textContent;
        navigator.clipboard.writeText(accountNo).then(() => {
            showToast("Berhasil disalin");
        });
    });
}

// --- Form Submission ---
const form = document.getElementById('workshopForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedBodyBagId || !selectedFlapBagId) {
            showToast("Harap pilih Shopping Bag Bekas untuk Cover & Flap");
            return;
        }

        if (isProcessingImages > 0) {
            showToast("Harap tunggu, gambar sedang diproses...");
            return;
        }

        // Final check for image data
        const charmBase64 = document.getElementById('charmBase64').value;
        const paymentBase64 = document.getElementById('paymentBase64').value;

        if (!charmBase64 || !paymentBase64) {
            showToast("Harap upload foto charm dan bukti bayar dengan benar");
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Mengirim Data...</span>';
        submitBtn.disabled = true;
        lucide.createIcons();
        
        showBlockerLoader("Mengirim data pendaftaran...");

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        payload.workshopType = 'artcycle-journal';

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success') {
                const params = new URLSearchParams({
                    name: payload.fullName || 'Peserta',
                    workshop: 'artcycle-journal',
                    bodyBagId: selectedBodyBagId,
                    flapBagId: selectedFlapBagId,
                    colorStrap: selectedStrapColor.name,
                    colorStrapHex: selectedStrapColor.hex,
                });
                window.location.href = '../success.html?' + params.toString();
            } else {
                throw new Error(result.message || "Gagal mengirim data.");
            }
        } catch (error) {
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage) {
                statusMessage.textContent = "Terjadi kesalahan: " + error.message;
                statusMessage.className = 'status-message error';
                statusMessage.style.display = 'block';
            } else {
                showToast("Kesalahan: " + error.message);
            }
        } finally {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            lucide.createIcons();
            hideBlockerLoader();
        }
    });
}

// --- Global Toast ---
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.textContent = msg;
    const container = document.getElementById('toastContainer');
    if (container) {
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Init
checkStock();
setupImageUpload('charmPhoto', 'charmUploadArea', 'charmPreview', 'charmBase64', 'charmMimeType');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview', 'paymentBase64', 'paymentMimeType');
