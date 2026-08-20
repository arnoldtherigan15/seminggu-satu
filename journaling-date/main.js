// ============================================================
//  Journaling Date (event member gratis) — Registration Logic
//  Alur: cek member via WA -> detail sesi + foto -> daftar.
// ============================================================

const ID = "journaling-date";
const MAX_SLOT = 6;
let _member = null;      // { wa, nickname } setelah lolos gate
let _configApplied = false;

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
          var el = document.getElementById("waInput");
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
    var closedLink = document.getElementById("closedHomeLink");
    if (closedLink) closedLink.href = "../warga/";
})();

// ---------- Utils ----------
function showToast(message) {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = message;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
function showBlocker(msg) {
    document.getElementById('blockerMessage').textContent = msg || 'Memproses…';
    document.getElementById('blockerLoader').classList.add('visible');
}
function hideBlocker() { document.getElementById('blockerLoader').classList.remove('visible'); }

function normWa(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.indexOf("62") === 0) return d;
    if (d.indexOf("0") === 0) return d;
    if (d.indexOf("8") === 0) return "0" + d;
    return d;
}

function fnGet(name, qs, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 15000);
    return fetch(`${SUPABASE_URL}/functions/v1/${name}${qs ? "?" + qs : ""}`, {
        headers: { apikey: SUPABASE_ANON_KEY },
        signal: controller.signal
    }).then(res => { clearTimeout(timer); return res.json(); })
      .catch(err => { clearTimeout(timer); throw err; });
}

// ---------- Sesi/batch yang lagi buka (bisa lebih dari 1 barengan) ----------
// Ganti applyConfig()+refreshSlot() lama yang baca Config doang (1 nilai per
// tipe workshop) -- sekarang ambil dari workshop-batches, yang udah gabungin
// data batch (override) sama Config server-side, per SESI yang beneran buka.
let _openBatches = [];
let _selectedBatchId = null;

async function loadOpenBatches() {
    _configApplied = true;
    let all;
    try {
        all = await fnGet("workshop-batches", "", 10000);
    } catch (e) {
        // Gagal cek -- fail-open (server tetap validasi ulang saat submit,
        // dan submit tanpa batchId eksplisit otomatis kepilih server kalau
        // cuma 1 sesi yang buka).
        const el = document.getElementById("jdSlotText");
        if (el) el.textContent = "Slot terbatas (" + MAX_SLOT + " orang)";
        return;
    }
    _openBatches = (all && all[ID]) || [];
    if (!_openBatches.length) {
        document.getElementById("gateSection").style.display = "none";
        document.getElementById("formSection").style.display = "none";
        document.getElementById("closedSection").style.display = "block";
        return;
    }
    if (!_selectedBatchId || !_openBatches.find(b => b.id === _selectedBatchId)) {
        _selectedBatchId = _openBatches[0].id;
    }
    renderBatchPicker();
    applyBatchSelection();
}
loadOpenBatches();
window.addEventListener("workshops:updated", loadOpenBatches);

function renderBatchPicker() {
    const box = document.getElementById("jdBatchPicker");
    if (!box) return;
    if (_openBatches.length < 2) { box.style.display = "none"; box.innerHTML = ""; return; }
    box.style.display = "block";
    box.innerHTML = `<p style="font-size:0.85rem;font-weight:600;margin:0 0 8px;">Pilih sesi:</p>` +
        _openBatches.map(b => `
        <div class="jd-batch-opt" data-batch="${b.id}" style="border:2px solid ${b.id === _selectedBatchId ? "var(--brand,#5e72e4)" : "#e5e7eb"};border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;">
            <div style="font-weight:700;">${b.label || "Sesi"}</div>
            <div style="font-size:0.82rem;color:#6b7280;">${b.displayDate || "-"}${b.workshopTime ? " · " + b.workshopTime : ""} — sisa ${b.remaining == null ? "?" : b.remaining} slot</div>
        </div>`).join("");
    box.querySelectorAll("[data-batch]").forEach(el => el.addEventListener("click", () => {
        _selectedBatchId = el.dataset.batch;
        renderBatchPicker();
        applyBatchSelection();
    }));
}

function applyBatchSelection() {
    const b = _openBatches.find(x => x.id === _selectedBatchId);
    const dt = document.getElementById("jdDate"); if (dt) dt.textContent = (b && b.displayDate) || "-";
    const tm = document.getElementById("jdTime"); if (tm) tm.textContent = (b && b.workshopTime) || "-";
    const ln = document.getElementById("jdLoc");
    if (ln) { ln.textContent = (b && b.locationName) || "-"; if (b && b.mapsLink) ln.href = b.mapsLink; }
    const el = document.getElementById("jdSlotText");
    const sub = document.getElementById("submitBtn");
    if (b && el && sub) {
        const left = b.remaining;
        if (left != null && left <= 0) {
            el.textContent = "Slot penuh 😢";
            sub.disabled = true; sub.innerHTML = "Slot Penuh";
        } else {
            el.textContent = left == null ? "Slot terbatas" : ("Sisa " + left + " slot");
            sub.disabled = false;
        }
    }
}

// ---------- Gate: cek member ----------
document.getElementById("checkBtn").addEventListener("click", checkMember);
document.getElementById("waInput").addEventListener("keydown", (e) => { if (e.key === "Enter") checkMember(); });

async function checkMember() {
    const raw = document.getElementById("waInput").value;
    const wa = normWa(raw);
    const msg = document.getElementById("gateMsg");
    if (!wa || wa.length < 8) { msg.className = "jd-msg err"; msg.textContent = "Nomor WhatsApp-nya kurang lengkap ya 🙏"; return; }
    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) { msg.className = "jd-msg err"; msg.textContent = "Konfigurasi belum siap, refresh dulu ya."; return; }

    const btn = document.getElementById("checkBtn");
    btn.disabled = true; msg.className = "jd-msg"; msg.textContent = "";
    showBlocker("Mengecek keanggotaan…");
    try {
        const r = await fnGet("member-check", "wa=" + encodeURIComponent(wa), 20000);
        if (r && r.isMember) {
            _member = { wa: wa, nickname: r.nickname || "Sahabat" };
            document.getElementById("gateSection").style.display = "none";
            document.getElementById("formSection").style.display = "block";
            document.getElementById("greetName").textContent = "Hai, " + _member.nickname + "! 👋";
            document.getElementById("submitBtn").disabled = true; // kunci sampai tiket dicek
            // Cek tiket dengan blocker biar user nggak submit duluan -- fetch
            // ulang biar sisa slot & daftar sesi buka paling fresh pas mau daftar.
            showBlocker("Mengecek tiket…");
            await loadOpenBatches();
        } else {
            msg.className = "jd-msg err";
            msg.innerHTML = "Nomor ini belum terdaftar sebagai member 🌱<br>Journaling Date khusus alumni event. Yuk ikut salah satu event kami dulu!";
        }
    } catch (e) {
        msg.className = "jd-msg err"; msg.textContent = "Gagal terhubung ke server. Coba lagi ya.";
    } finally {
        btn.disabled = false; hideBlocker();
    }
}

// ---------- Foto (kompres + preview) ----------
function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
                else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject; img.src = ev.target.result;
        };
        reader.onerror = reject; reader.readAsDataURL(file);
    });
}

function wirePhoto(inputId, boxId, previewId, b64Id) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast("Ukuran gambar maksimal 5MB."); input.value = ""; return; }
        try {
            showBlocker("Memproses foto…");
            const dataUrl = await compressImage(file, 1200, 0.8);
            document.getElementById(b64Id).value = dataUrl.split(',')[1];
            const box = document.getElementById(boxId), prev = document.getElementById(previewId);
            prev.src = dataUrl; box.classList.add('has-image');
        } catch (err) { showToast("Gagal memproses foto, coba lagi."); }
        finally { hideBlocker(); }
    });
}
wirePhoto('photo1', 'box1', 'preview1', 'photo1Base64');
wirePhoto('photo2', 'box2', 'preview2', 'photo2Base64');
wirePhoto('photo3', 'box3', 'preview3', 'photo3Base64');
wirePhoto('photo4', 'box4', 'preview4', 'photo4Base64');

// ---------- Submit ----------
document.getElementById("jdForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!_member) { showToast("Cek keanggotaan dulu ya."); return; }

    const btn = document.getElementById("submitBtn");
    const status = document.getElementById("statusMessage");
    const original = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = "Mengirim…";
    status.style.display = "none";
    showBlocker("Mengamankan tempatmu…");

    const payload = {
        workshopType: ID,
        batchId: _selectedBatchId || "",
        whatsapp: _member.wa,
        nickname: _member.nickname,
        photo1Base64: document.getElementById("photo1Base64").value || "",
        photo2Base64: document.getElementById("photo2Base64").value || "",
        photo3Base64: document.getElementById("photo3Base64").value || "",
        photo4Base64: document.getElementById("photo4Base64").value || ""
    };

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 60000);
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/register-workshop`, {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(tid);
        const result = await res.json();
        if (result.status === "success") {
            const params = new URLSearchParams({ name: _member.nickname, whatsapp: _member.wa, workshop: ID });
            if (new URLSearchParams(location.search).get("from") === "member") params.set("from", "member");
            window.location.href = "../success.html?" + params.toString();
        } else {
            throw new Error(result.message || "Terjadi kesalahan.");
        }
    } catch (err) {
        status.className = "jd-msg err";
        status.textContent = (err.name === "AbortError")
            ? "Koneksi timeout. Cek internetmu lalu coba lagi ya."
            : err.message;
        status.style.display = "block";
    } finally {
        clearTimeout(tid);
        btn.disabled = false; btn.innerHTML = original;
        if (window.lucide) lucide.createIcons();
        hideBlocker();
    }
});

// Datang dari portal member (udah login) -> WA dibawa lewat ?wa= -> auto cek, nggak input ulang
(function () {
    var wa = new URLSearchParams(location.search).get("wa");
    if (wa) {
        document.getElementById("waInput").value = wa;
        checkMember();
    }
})();

if (window.lucide) lucide.createIcons();
