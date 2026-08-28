// ============================================================
//  Upcycle Bag Journal — Registration Logic
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
// Warna bag yang udah abis (takenBags) juga di-scope per batch sekarang --
// stok fisik itu punya 1 sesi, bukan digabung semua sesi.
let _workshopData = getWorkshopById("upcycle-journal"); // fallback rekening bank dkk (tetap type-level)
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

    // Warna bag yang udah abis -- khusus sesi ini
    takenBags = b.takenBags || [];
    renderBagSliders();
    renderStrapColors();
    if (window.lucide) lucide.createIcons();
}

// ============================================================
//  Data Bag Images (Stock)
// ============================================================
// Total 66 bags, each unique
const bagIds = Array.from({ length: 66 }, (_, i) => `Bag_${i + 1}`);

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

// Ambil daftar sesi yang lagi buka + stok bag masing-masing -- ganti
// checkStock()/fetchWorkshopCounts() lama. Dipanggil pas load & pas config
// server ke-refresh ('workshops:updated').
async function loadOpenBatches() {
    showBlockerLoader('Mengecek ketersediaan stok bag...');
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/workshop-batches`, { headers: { apikey: SUPABASE_ANON_KEY }, signal: controller.signal });
        clearTimeout(timer);
        const all = await res.json();
        _openBatches = (all && all['upcycle-journal']) || [];
    } catch (err) {
        console.error('Cek sesi gagal:', err);
        hideBlockerLoader();
        return; // fail-open -- server tetap validasi ulang pas submit
    }
    hideBlockerLoader();
    if (!_openBatches.length) {
        window.location.replace('../closed.html?workshop=upcycle-journal&reason=sold-out');
        return;
    }
    if (!_selectedBatchId || !_openBatches.find(function (b) { return b.id === _selectedBatchId; })) {
        const visible = _openBatches.filter(function (b) { return !b.hideFromPicker; });
        _selectedBatchId = matchBatchFromQuery() || (visible[0] || _openBatches[0]).id;
    }
    renderBatchPicker();
    applyBatchDisplay(); // ini juga yang manggil renderBagSliders/renderStrapColors
    urgencyBadge.classList.add('show');
    const left = getSelectedBatch().remaining;
    urgencyText.textContent = left == null ? 'Tiket tersedia' : `Sisa ${left} Tiket!`;
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

    const visibleBagsList = bagIds.filter(id => !takenBags.includes(id));
    const bagCount = visibleBagsList.length;
    const itemWidth = 140 + 15; // item width + gap

    // To make it infinite, we render the set 3 times: [set1] [set2] [set3]
    // We will start at [set2].
    for (let setIndex = 0; setIndex < 3; setIndex++) {
        visibleBagsList.forEach(id => {
            // Special check: if bag is currently selected for the OTHER part by this user
            const isReservedByMe = (type === 'body' && selectedFlapBagId === id) ||
                (type === 'flap' && selectedBodyBagId === id);

            // Check if currently selected for THIS slider
            const isActive = (type === 'body' && selectedBodyBagId === id) ||
                (type === 'flap' && selectedFlapBagId === id);

            const item = document.createElement('div');
            item.className = `bag-item ${isReservedByMe ? 'reserved' : ''} ${isActive ? 'active' : ''}`;
            item.setAttribute('data-id', id);

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

    // Set initial scroll to middle set after a short delay to ensure rendering
    setTimeout(() => {
        // Disable smooth scroll & snap for the jump
        const originalSmooth = container.style.scrollBehavior;
        const originalSnap = container.style.scrollSnapType;
        container.style.scrollBehavior = 'auto';
        container.style.scrollSnapType = 'none';
        
        container.scrollLeft = bagCount * itemWidth;
        
        // Re-enable after jump
        setTimeout(() => {
            container.style.scrollBehavior = originalSmooth;
            container.style.scrollSnapType = originalSnap;
        }, 50);

        // Init infinite scroll listener
        if (!container.dataset.infiniteInit) {
            initInfiniteScroll(container, bagCount, itemWidth);
            container.dataset.infiniteInit = "true";
        }
    }, 50);
}

function initInfiniteScroll(slider, bagCount, itemWidth) {
    const setWidth = bagCount * itemWidth;
    
    slider.addEventListener('scroll', () => {
        // If we've scrolled into the first set (left), jump to the second set (middle)
        if (slider.scrollLeft < setWidth * 0.5) {
            slider.style.scrollBehavior = 'auto';
            slider.scrollLeft += setWidth;
            slider.style.scrollBehavior = 'smooth';
        } 
        // If we've scrolled into the third set (right), jump back to the second set (middle)
        else if (slider.scrollLeft > setWidth * 1.5) {
            slider.style.scrollBehavior = 'auto';
            slider.scrollLeft -= setWidth;
            slider.style.scrollBehavior = 'smooth';
        }
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
    const sliderId = type === 'body' ? 'bodyBagSlider' : 'flapBagSlider';
    
    if (type === 'body') {
        selectedBodyBagId = id;
        document.querySelectorAll(`#${sliderId} .bag-item`).forEach(i => i.classList.remove('active'));
        // Sync active class to all clones of this ID in THIS slider
        document.querySelectorAll(`#${sliderId} .bag-item[data-id="${id}"]`).forEach(i => i.classList.add('active'));
        
        const motifBody = document.getElementById('motifBody');
        motifBody.style.backgroundImage = `url(${imgPath})`;
        badgeBody.textContent = `Cover: ${id.replace('_', ' ')}`;
        inputBodyBagId.value = id;
    } else {
        selectedFlapBagId = id;
        document.querySelectorAll(`#${sliderId} .bag-item`).forEach(i => i.classList.remove('active'));
        // Sync active class to all clones of this ID in THIS slider
        document.querySelectorAll(`#${sliderId} .bag-item[data-id="${id}"]`).forEach(i => i.classList.add('active'));
        
        const motifFlap = document.getElementById('motifFlap');
        motifFlap.style.backgroundImage = `url(${imgPath})`;
        badgeFlap.textContent = `Flap: ${id.replace('_', ' ')}`;
        inputFlapBagId.value = id;
    }

    // Update "Reserved" status in the OTHER slider
    const otherType = type === 'body' ? 'flap' : 'body';
    const otherSliderId = otherType === 'body' ? 'bodyBagSlider' : 'flapBagSlider';
    const otherContainer = document.getElementById(otherSliderId);
    
    if (otherContainer) {
        const savedScroll = otherContainer.scrollLeft;
        renderSlider(otherContainer, otherType);
        setTimeout(() => {
            otherContainer.scrollLeft = savedScroll;
        }, 60);
    }
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

        // Config belum siap (jarang) -> jangan submit dgn data kosong
        if (!_workshopData) {
            showToast("Data workshop masih dimuat, tunggu sebentar ya.");
            return;
        }

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
        payload.workshopType = 'upcycle-journal';
        payload.batchId = _selectedBatchId || '';

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
                    workshop: 'upcycle-journal',
                    batchId: payload.batchId || '',
                    bodyBagId: selectedBodyBagId,
                    flapBagId: selectedFlapBagId,
                    colorStrap: selectedStrapColor.name,
                    colorStrapHex: selectedStrapColor.hex,
                });
                if (new URLSearchParams(location.search).get('from') === 'member') params.set('from', 'member');
                window.location.href = '../success.html?' + params.toString();
            } else {
                throw new Error(result.message || "Gagal mengirim data.");
            }
        } catch (error) {
            const msg = (error.name === 'AbortError')
                ? "Koneksi timeout. Data mungkin belum terkirim — cek internetmu lalu coba lagi. Kalau tetap gagal, hubungi admin ya."
                : ("Terjadi kesalahan: " + error.message);
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage) {
                statusMessage.textContent = msg;
                statusMessage.className = 'status-message error';
                statusMessage.style.display = 'block';
                statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                showToast(msg);
            }
        } finally {
            clearTimeout(timeoutId);
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

loadOpenBatches();
setupImageUpload('charmPhoto', 'charmUploadArea', 'charmPreview', 'charmBase64', 'charmMimeType');
setupImageUpload('paymentPhoto', 'paymentUploadArea', 'paymentPreview', 'paymentBase64', 'paymentMimeType');

// ============================================================
//  AUTO-UPDATE saat config server datang (biar harga/tanggal SELALU terbaru).
// ============================================================
window.addEventListener('workshops:updated', function () {
    _workshopData = getWorkshopById('upcycle-journal');
    loadOpenBatches();
});
