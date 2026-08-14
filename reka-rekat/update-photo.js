// ============================================================
//  Reka Rekat — Upload Ulang Foto (link personal ?rid=...)
//  (Seminggu Satu by Arnold)
// ============================================================

const params = new URLSearchParams(location.search);
const RID = params.get("rid") || "";
const NAMA = params.get("nama") || "";

if (!RID) {
    document.getElementById("ridMissing").style.display = "block";
    document.getElementById("formSection").style.display = "none";
} else if (NAMA) {
    document.getElementById("greetingText").textContent =
        "Halo " + NAMA + "! Ganti 4 foto journal kamu di sini kapan aja sebelum hari-H.";
}

function showBlockerLoader(message) {
    const blocker = document.getElementById("blockerLoader");
    if (blocker) {
        document.getElementById("blockerMessage").textContent = message || "Sebentar ya...";
        blocker.classList.add("visible");
    }
}

function hideBlockerLoader() {
    const blocker = document.getElementById("blockerLoader");
    if (blocker) blocker.classList.remove("visible");
}

// --- Kompres gambar (sama pola kayak form pendaftaran reka-rekat) ---
function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = () => reject(new Error("Gagal memuat gambar buat dikompres -- coba pilih ulang fotonya."));
        };
        reader.onerror = () => reject(new Error("Gagal membaca file gambar -- coba pilih ulang fotonya."));
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Gagal membaca file gambar -- coba pilih ulang fotonya."));
    });
}

function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error((label || "Proses") + " timeout")), ms);
        promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
}

async function getCompressedBase64(file) {
    try {
        const dataUrl = await withTimeout(compressImage(file, 800, 0.7), 20000, "Kompres gambar");
        return dataUrl.split(",")[1];
    } catch (err) {
        console.warn("Canvas compression failed, falling back to raw base64:", err);
        return await withTimeout(fileToBase64(file), 20000, "Baca gambar");
    }
}

const selectedFiles = {};

function setupImageUpload(inputId) {
    const input = document.getElementById(inputId);
    const previewBox = document.getElementById(inputId + "UploadArea");
    const previewImg = document.getElementById(inputId + "Preview");
    if (!input) return;

    input.addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            alert("Ukuran gambar terlalu besar! Maksimal 20MB.");
            input.value = "";
            previewBox.classList.remove("has-image");
            delete selectedFiles[inputId];
            return;
        }

        const isHeic = file.name.toLowerCase().endsWith(".heic") ||
            file.name.toLowerCase().endsWith(".heif") ||
            file.type === "image/heic" || file.type === "image/heif";

        let targetBlob = file;
        if (isHeic) {
            if (typeof heic2any === "undefined") {
                alert("Pustaka konverter HEIC belum dimuat.");
                return;
            }
            showBlockerLoader("Mengonversi foto HEIC ke JPEG...");
            try {
                const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
                targetBlob = Array.isArray(result) ? result[0] : result;
            } catch (err) {
                console.error("HEIC conversion error:", err);
                alert("Gagal memproses berkas HEIC. Silakan gunakan format JPG atau PNG.");
                input.value = "";
                previewBox.classList.remove("has-image");
                delete selectedFiles[inputId];
                return;
            } finally {
                hideBlockerLoader();
            }
        }

        selectedFiles[inputId] = targetBlob;
        previewImg.src = URL.createObjectURL(targetBlob);
        previewBox.classList.add("has-image");
    });
}

["photo1", "photo2", "photo3", "photo4"].forEach(setupImageUpload);

// --- Submit ---
const form = document.getElementById("photoForm");
const statusMessage = document.getElementById("statusMessage");
const submitBtn = document.getElementById("submitBtn");

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!RID) return;

        const missing = ["photo1", "photo2", "photo3", "photo4"].filter(id => {
            const inp = document.getElementById(id);
            return !selectedFiles[id] && !(inp && inp.files && inp.files.length);
        });
        if (missing.length) {
            alert("Harap pilih ke-4 foto ya (yang belum dipilih: " + missing.map(m => "Foto " + m.replace("photo", "")).join(", ") + ")");
            return;
        }

        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> <span>Memproses...</span>';
        submitBtn.disabled = true;
        lucide.createIcons();
        statusMessage.className = "status-message";
        statusMessage.style.display = "none";
        showBlockerLoader("Mengompresi foto...");

        const payload = { rid: RID };
        try {
            for (const id of ["photo1", "photo2", "photo3", "photo4"]) {
                const file = selectedFiles[id] || document.getElementById(id).files[0];
                payload[id + "Base64"] = await getCompressedBase64(file);
            }
        } catch (compressErr) {
            hideBlockerLoader();
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            lucide.createIcons();
            alert("Gagal memproses gambar: " + compressErr.message);
            return;
        }

        showBlockerLoader("Menyimpan foto...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/update-reka-rekat-photos`, {
                method: "POST",
                headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const result = await response.json();

            if (result.status === "success") {
                document.getElementById("formSection").innerHTML =
                    '<div style="text-align:center;padding:2rem 0;">' +
                    '<i data-lucide="check-circle-2" style="width:56px;height:56px;color:var(--success-color);"></i>' +
                    "<h3 style=\"margin-top:1rem;\">Foto berhasil disimpan! 🎉</h3>" +
                    '<p style="color:var(--text-secondary);margin-top:.5rem;">Makasih ya, foto journal kamu udah keupdate. Sampai ketemu di acaranya!</p>' +
                    "</div>";
                lucide.createIcons();
            } else {
                throw new Error(result.message || "Terjadi kesalahan pada server.");
            }
        } catch (error) {
            const msg = (error.name === "AbortError")
                ? "Koneksi timeout. Coba lagi ya, atau hubungi admin kalau tetap gagal."
                : ("Gagal menyimpan foto: " + error.message);
            statusMessage.textContent = msg;
            statusMessage.className = "status-message error";
            statusMessage.style.display = "block";
            statusMessage.scrollIntoView({ behavior: "smooth", block: "center" });
        } finally {
            clearTimeout(timeoutId);
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            lucide.createIcons();
            hideBlockerLoader();
        }
    });
}
