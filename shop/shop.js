// Toko pre-order Seminggu Satu -- katalog, keranjang, checkout 4 langkah
// (Keranjang -> Data & alamat -> Ongkir JNE -> Bayar + bukti), lalu ke halaman tracking.
// Link khusus produk: /shop/?p=KODE (produk langsung masuk keranjang), ?ref=ig|threads|wa (asal order).
(function () {
    const $ = (id) => document.getElementById(id);
    const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const CART_KEY = 'ss_shop_cart', FORM_KEY = 'ss_shop_form';
    const S = { only: '', products: [], cart: new Map(), bank: null, ongkirReady: false, step: 0, dest: null, ship: null, options: [], proof: '', ref: '', q: '' };
    const STEPS = [{ k: 'cart', t: 'Keranjang' }, { k: 'addr', t: 'Data & alamat' }, { k: 'pay', t: 'Bayar' }];

    async function api(action, body) {
        const res = await fetch(SUPABASE_URL + '/functions/v1/shop-public', {
            method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify(Object.assign({ action }, body || {})),
        });
        const j = await res.json().catch(() => ({ status: 'error', message: 'Server lagi bermasalah, coba lagi ya.' }));
        if (j.status !== 'success') throw new Error(j.message || 'Gagal');
        return j;
    }
    function toast(msg, bad) {
        const c = $('toastContainer'); if (!c) return;
        const t = document.createElement('div');
        t.className = 'toast ' + (bad ? 'error' : 'success'); t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3500);
    }
    const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

    // ---------- katalog ----------
    const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const imgHtml = (p, cls) => p.image ? `<div class="${cls}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div>` : `<div class="${cls}">${esc(initials(p.name))}</div>`;
    const keyOf = (id, v) => id + '::' + (v || '');
    const parseKey = (k) => { const i = k.indexOf('::'); return i < 0 ? { id: k, v: '' } : { id: k.slice(0, i), v: k.slice(i + 2) }; };
    function qtyHtml(id, q) { return `<div class="sh-qty"><button type="button" data-dec="${esc(id)}" aria-label="Kurangi">&minus;</button><b>${q}</b><button type="button" data-inc="${esc(id)}" aria-label="Tambah">+</button></div>`; }
    // daftar produk (list, bukan grid -- tetap rapi walau produknya banyak) + cari kalau > 6
    function renderGrid() {
        const g = $('shGrid');
        if (!S.products.length) { g.innerHTML = '<div class="sh-empty">Belum ada produk yang dibuka buat pre-order. Pantau Instagram kami ya!</div>'; return; }
        const sw = $('shSearchWrap');
        if (sw) sw.hidden = S.products.length <= 6;
        const q = S.q.toLowerCase();
        const list = S.products.filter(p => (!S.only || p.id === S.only) && (!q || (p.name + ' ' + (p.desc || '')).toLowerCase().includes(q)));
        const onlyBar = $('shOnlyBar');
        if (onlyBar) onlyBar.hidden = !S.only;
        g.innerHTML = list.length ? list.map(p => {
            const vars = p.variants || [];
            const total = [...S.cart.entries()].filter(([k]) => parseKey(k).id === p.id).reduce((s, [, q]) => s + q, 0);
            const key = keyOf(p.id, '');
            const act = vars.length ? '' : `<div class="sh-row-act">${S.cart.get(key) ? qtyHtml(key, S.cart.get(key)) : `<button type="button" class="sh-add" data-inc="${esc(key)}">Tambah</button>`}</div>`;
            // produk bervarian: pilih varian lewat chip (1 ketuk = +1), atur jumlah per varian di bawahnya
            const varHtml = vars.length ? `<div class="sh-vars"><span class="sh-vars-lbl">Pilih varian:</span>${vars.map(v => {
                const k = keyOf(p.id, v), q = S.cart.get(k) || 0;
                return q ? `<div class="sh-var on"><span>${esc(v)}</span>${qtyHtml(k, q)}</div>` : `<button type="button" class="sh-var" data-inc="${esc(k)}">+ ${esc(v)}</button>`;
            }).join('')}</div>` : '';
            return `<article class="sh-row${total ? ' in-cart' : ''}${vars.length ? ' has-vars' : ''}">${imgHtml(p, 'sh-row-img')}
                <div class="sh-row-txt">
                    <b>${esc(p.name)}</b>
                    <span class="sh-row-price">${rp(p.price)}</span>
                    <span class="sh-pre">${esc(p.preorderNote || 'Pre-order')}</span>
                    ${p.desc ? `<small class="sh-desc">${esc(p.desc)}</small>` : ''}
                </div>
                ${act}${varHtml}
            </article>`;
        }).join('') : '<div class="sh-empty">Nggak ada produk yang cocok.</div>';
    }
    function cartLines() { return [...S.cart.entries()].map(([k, qty]) => { const { id, v } = parseKey(k); return { key: k, p: S.products.find(x => x.id === id), v, qty }; }).filter(l => l.p && l.qty > 0); }
    const lineName = (l) => l.p.name + (l.v ? ' - ' + l.v : '');
    const subtotal = () => cartLines().reduce((s, l) => s + l.p.price * l.qty, 0);
    function saveCart() { store.set(CART_KEY, [...S.cart.entries()]); }
    function setQty(id, q) {
        if (q <= 0) S.cart.delete(id); else S.cart.set(id, Math.min(50, q));
        saveCart(); S.ship = null; renderGrid(); renderCartbar();
        if (screen() === 'checkout' && STEPS[S.step].k === 'cart') renderCart();
        if (screen() === 'checkout' && !cartLines().length) go('produk');
    }
    function renderCartbar() {
        const lines = cartLines(), n = lines.reduce((s, l) => s + l.qty, 0);
        const bar = $('shCartbar');
        bar.hidden = !n || screen() !== 'produk';
        document.body.classList.toggle('sh-has-cart', !bar.hidden);
        $('shCartCount').textContent = n + ' barang';
        $('shCartTotal').textContent = rp(subtotal());
    }

    // ---------- 2 layar: Produk (daftar) & Checkout -- pakai hash biar tombol back HP jalan ----------
    function screen() { return location.hash === '#checkout' && cartLines().length ? 'checkout' : 'produk'; }
    function applyScreen(scroll) {
        const sc = screen();
        $('shCatalog').hidden = sc !== 'produk';
        $('shCheckout').hidden = sc !== 'checkout';
        document.body.classList.toggle('sh-on-checkout', sc === 'checkout');
        renderCartbar();
        if (sc === 'checkout') showStep(S.step || 0); else renderGrid();
        if (scroll) { const t = (sc === 'checkout' ? $('shCheckout') : $('shCatalog')).getBoundingClientRect().top + window.scrollY - 12; window.scrollTo({ top: Math.max(0, t), behavior: 'smooth' }); }
    }
    function go(sc) {
        if (sc === 'checkout' && !cartLines().length) { toast('Keranjangnya masih kosong', true); return; }
        const h = sc === 'checkout' ? '#checkout' : '#produk';
        if (location.hash === h) applyScreen(true); else location.hash = h;
    }
    window.addEventListener('hashchange', () => applyScreen(true));
    function openCheckout() { S.step = 0; go('checkout'); }
    function showStep(i) {
        S.step = Math.max(0, Math.min(STEPS.length - 1, i));
        document.querySelectorAll('.sh-step').forEach(el => { el.hidden = el.dataset.step !== STEPS[S.step].k; });
        $('shStepTitle').textContent = STEPS[S.step].t;
        $('shStepCount').textContent = `Langkah ${S.step + 1} dari ${STEPS.length}`;
        $('shBars').innerHTML = STEPS.map((s, j) => `<span class="rs-bar${j < S.step ? ' done' : j === S.step ? ' on' : ''}"><i></i></span>`).join('');
        $('shErr').hidden = true;
        $('shBack').textContent = S.step === 0 ? '← Lihat produk' : '← Kembali';
        $('shNext').innerHTML = S.step === STEPS.length - 1 ? '<span>Kirim pesanan</span>' : '<span>Lanjut</span> &rarr;';
        const k = STEPS[S.step].k;
        if (k === 'cart') renderCart();
        if (k === 'pay') { renderPay(); loadShip(); }
    }
    function err(msg) { const e = $('shErr'); e.textContent = msg; e.hidden = false; }
    function renderCart() {
        const lines = cartLines();
        $('shCartList').innerHTML = lines.length ? lines.map(l => `<div class="sh-cline">${imgHtml(l.p, 'sh-cline-img')}
            <div class="sh-cline-txt"><b>${esc(l.p.name)}</b>${l.v ? `<span class="sh-cline-var">${esc(l.v)}</span>` : ''}<small>${rp(l.p.price)} · ${esc(l.p.preorderNote || 'Pre-order')}</small></div>
            ${qtyHtml(l.key, l.qty)}</div>`).join('') + `<div class="sh-sum-row total" style="border:0;padding-top:12px"><span>Subtotal</span><b>${rp(subtotal())}</b></div>`
            : '<p class="sh-muted">Keranjang kosong.</p>';
    }
    // alamat tujuan (autocomplete RajaOngkir, di server di-cache)
    let destT = 0, destSeq = 0;
    function onDestInput() {
        const q = $('shDestQ').value.trim(), list = $('shDestList');
        clearTimeout(destT);
        if (q.length < 3) { list.hidden = true; return; }
        destT = setTimeout(async () => {
            const my = ++destSeq;
            list.hidden = false; list.innerHTML = '<p>Mencari…</p>';
            try {
                const r = await api('searchDest', { q });
                if (my !== destSeq) return;
                list.innerHTML = r.results.length ? r.results.map(d => `<button type="button" data-dest="${d.id}" data-label="${esc(d.label)}">${esc(d.label)}</button>`).join('') : '<p>Nggak ketemu. Coba ketik nama kecamatan / kota lain.</p>';
            } catch (e) { list.innerHTML = '<p>' + esc(e.message) + '</p>'; }
        }, 400);
    }
    function pickDest(id, label) {
        S.dest = { id: Number(id), label }; S.ship = null;
        $('shDestList').hidden = true; $('shDestQ').closest('.input-wrapper').hidden = true;
        const pk = $('shDestPicked'); pk.hidden = false;
        pk.innerHTML = `<span>${esc(label)}</span><button type="button" id="shDestChange">Ganti</button>`;
        saveForm();
    }
    function clearDest() { S.dest = null; S.ship = null; $('shDestPicked').hidden = true; $('shDestQ').closest('.input-wrapper').hidden = false; $('shDestQ').value = ''; $('shDestQ').focus(); saveForm(); }

    // ongkir JNE REG dihitung otomatis pas masuk langkah Bayar (nggak ada pilihan layanan)
    let shipSeq = 0;
    async function loadShip() {
        const my = ++shipSeq;
        const info = $('shShipInfo');
        const grams = cartLines().reduce((s, l) => s + (l.p.weight || 150) * l.qty, 0);
        info.hidden = false;
        info.textContent = `Dikirim pakai JNE REG dari Jakarta Selatan ke ${S.dest ? S.dest.label : '-'} · berat ±${(grams / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg`;
        $('shPayBox').hidden = true;
        if (!S.ongkirReady) {
            $('shShipList').innerHTML = `<p class="rs-err">Cek ongkir otomatis lagi belum aktif. Kamu tetap bisa pesan lewat WhatsApp admin, ongkirnya kami hitungin.</p>
                <a class="submit-btn" style="text-decoration:none;margin-top:10px" target="_blank" rel="noopener" href="${waOrderLink()}">Pesan lewat WhatsApp</a>`;
            return;
        }
        if (S.ship && S.ship._dest === S.dest.id && S.ship._grams === grams) { $('shShipList').innerHTML = ''; $('shPayBox').hidden = false; renderPay(); return; }
        S.ship = null;
        $('shShipList').innerHTML = '<p class="sh-muted">Ngitung ongkir JNE REG…</p>';
        try {
            const r = await api('ongkir', { destId: S.dest.id, items: cartPayload() });
            if (my !== shipSeq) return;
            const reg = r.ship || (r.options || []).find(o => String(o.service).toUpperCase() === 'REG');
            if (!reg) throw new Error('JNE REG ke alamat ini nggak tersedia. Hubungi admin lewat WA ya.');
            S.ship = Object.assign({}, reg, { _dest: S.dest.id, _grams: grams });
            $('shShipList').innerHTML = '';
            $('shPayBox').hidden = false;
            renderPay();
        } catch (e) {
            if (my !== shipSeq) return;
            $('shShipList').innerHTML = `<p class="rs-err">${esc(e.message)}</p>
                <a class="submit-btn" style="text-decoration:none;margin-top:10px" target="_blank" rel="noopener" href="${waOrderLink()}">Pesan lewat WhatsApp</a>`;
        }
    }
    function waOrderLink() {
        const lines = cartLines().map(l => `- ${lineName(l)} x${l.qty}`).join('\n');
        const msg = `Halo admin Seminggu Satu, aku mau pre-order:\n${lines}\n\nNama: ${$('shName').value}\nAlamat: ${$('shAddr').value}${S.dest ? ', ' + S.dest.label : ''}`;
        return 'https://wa.me/6281214574782?text=' + encodeURIComponent(msg);
    }
    const cartPayload = () => cartLines().map(l => ({ productId: l.p.id, qty: l.qty, variant: l.v }));

    function renderPay() {
        const sub = subtotal(), ship = S.ship ? S.ship.cost : 0, total = sub + ship;
        $('shSummary').innerHTML = cartLines().map(l => `<div class="sh-sum-row"><span>${esc(lineName(l))} ×${l.qty}</span><b>${rp(l.p.price * l.qty)}</b></div>`).join('') +
            `<div class="sh-sum-row"><span>Ongkir JNE REG${S.ship && S.ship.etd ? ' · estimasi ' + esc(S.ship.etd).replace(/day/i, 'hari') : ''}</span><b>${S.ship ? rp(ship) : '…'}</b></div>` +
            `<div class="sh-sum-row total"><span>Total transfer</span><b>${rp(total)}</b></div>`;
        $('shPayTotal').textContent = rp(total);
        const b = S.bank || {};
        $('shBankName').textContent = b.bank || ''; $('shBankNo').textContent = b.number || ''; $('shBankOwner').textContent = b.holder ? 'a.n ' + b.holder : '';
    }
    // bukti transfer -> dikecilin (maks 1600px, JPEG) biar upload cepet
    function compress(file) {
        return new Promise((resolve, reject) => {
            const img = new Image(), url = URL.createObjectURL(file);
            img.onload = () => {
                const k = Math.min(1, 1600 / Math.max(img.width, img.height));
                const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambarnya nggak kebaca. Coba screenshot bukti transfernya lalu upload ulang.')); };
            img.src = url;
        });
    }
    async function onProof() {
        const f = $('shProof').files && $('shProof').files[0]; if (!f) return;
        $('shProofTxt').textContent = 'Memproses…';
        try {
            const d = await compress(f); S.proof = d;
            let prev = $('shProofPrev');
            if (!prev) { prev = document.createElement('img'); prev.id = 'shProofPrev'; prev.className = 'preview-img'; prev.alt = 'Bukti transfer'; $('shProofArea').appendChild(prev); }
            prev.src = d; $('shProofTxt').textContent = 'Ganti foto';
            $('shErr').hidden = true;
        } catch (e) { S.proof = ''; $('shProofTxt').textContent = 'Upload bukti transfer'; err(e.message); }
    }

    function validate() {
        const k = STEPS[S.step].k;
        if (k === 'cart' && !cartLines().length) return 'Keranjangnya kosong.';
        if (k === 'addr') {
            const miss = [];
            if (!$('shName').value.trim()) miss.push('nama');
            if ($('shWa').value.replace(/\D/g, '').length < 9) miss.push('nomor WhatsApp');
            if (!S.dest) miss.push('kecamatan tujuan (pilih dari daftar)');
            if ($('shAddr').value.trim().length < 10) miss.push('alamat lengkap');
            if (miss.length) return 'Belum lengkap: ' + miss.join(', ');
        }
        if (k === 'pay') {
            if (!S.ongkirReady) return 'Pesan lewat WhatsApp dulu ya, ongkir otomatis belum aktif.';
            if (!S.ship) return 'Ongkirnya belum kehitung. Tunggu sebentar atau cek lagi kecamatannya.';
            if (!S.proof) return 'Upload bukti transfer dulu ya.';
        }
        return '';
    }
    async function next() {
        const m = validate(); if (m) { err(m); return; }
        if (S.step < STEPS.length - 1) { showStep(S.step + 1); $('shCheckout').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const btn = $('shNext'); btn.disabled = true; btn.innerHTML = '<span>Mengirim…</span>';
        try {
            const r = await api('createOrder', {
                name: $('shName').value.trim(), wa: $('shWa').value.trim(), address: $('shAddr').value.trim(),
                destId: S.dest.id, destLabel: S.dest.label, service: 'REG', items: cartPayload(),
                proofBase64: S.proof.split(',')[1], note: $('shNote').value.trim(), ref: S.ref,
            });
            S.cart.clear(); saveCart();
            try { localStorage.removeItem(FORM_KEY); const ls = store.get('ss_shop_orders', []); ls.unshift(r.token); store.set('ss_shop_orders', ls.slice(0, 10)); } catch (e) { }
            location.href = 'track.html?t=' + encodeURIComponent(r.token) + '&new=1';
        } catch (e) {
            err(e.message); btn.disabled = false; btn.innerHTML = '<span>Kirim pesanan</span>';
            if (/ongkir|layanan/i.test(e.message)) { S.ship = null; }
        }
    }
    function back() {
        if (S.step === 0) { go('produk'); return; }
        showStep(S.step - 1);
    }
    function saveForm() { store.set(FORM_KEY, { name: $('shName').value, wa: $('shWa').value, addr: $('shAddr').value, dest: S.dest }); }

    // ---------- init ----------
    async function init() {
        const params = new URLSearchParams(location.search);
        const ref = (params.get('ref') || '').toLowerCase();
        S.ref = { ig: 'instagram', instagram: 'instagram', threads: 'threads', wa: 'whatsapp', whatsapp: 'whatsapp' }[ref] || '';
        store.get(CART_KEY, []).forEach(([id, q]) => S.cart.set(id, q));
        const f = store.get(FORM_KEY, {});
        $('shName').value = f.name || ''; $('shWa').value = f.wa || ''; $('shAddr').value = f.addr || '';
        if (f.dest && f.dest.id) pickDest(f.dest.id, f.dest.label);
        try {
            const r = await api('catalog');
            S.products = r.products; S.bank = r.bank; S.ongkirReady = !!r.ongkirReady;
        } catch (e) {
            $('shGrid').innerHTML = `<div class="sh-empty">Toko lagi nggak bisa dimuat: ${esc(e.message)}<br><button type="button" class="sh-link" onclick="location.reload()">Coba lagi</button></div>`;
            return;
        }
        // buang isi keranjang yang produk/varian-nya udah nggak ada (atau keranjang format lama)
        [...S.cart.keys()].forEach(k => { const { id, v } = parseKey(k); const p = S.products.find(x => x.id === id);
            if (!p || (p.variants && p.variants.length ? !p.variants.includes(v) : v) || k.indexOf('::') < 0) S.cart.delete(k); });
        const want = params.get('p');
        let jump = false;
        if (want) {
            const p = S.products.find(x => x.code && x.code.toLowerCase() === want.toLowerCase()) || S.products.find(x => x.id === want);
            if (p) {
                const vars = p.variants || [];
                const wantV = vars.find(v => v.toLowerCase() === (params.get('v') || '').toLowerCase());
                S.cart.clear(); jump = true;
                const qs = S.ref ? '?ref=' + encodeURIComponent(ref) : '';
                if (vars.length && !wantV) {
                    // produk bervarian: tampilin produk itu aja dulu biar pembeli pilih varian
                    S.only = p.id;
                    history.replaceState(null, '', location.pathname + qs + '#produk');
                } else {
                    // link khusus produk (tanpa varian / varian udah ditentuin ?v=): langsung checkout
                    S.cart.set(keyOf(p.id, wantV || ''), 1);
                    history.replaceState(null, '', location.pathname + qs + '#checkout');
                }
            }
            else toast('Produk dari link itu lagi nggak dibuka pre-order', true);
        }
        saveCart();
        S.step = 0;
        applyScreen(false);
    }

    document.addEventListener('click', (e) => {
        const inc = e.target.closest('[data-inc]'); if (inc) { setQty(inc.dataset.inc, (S.cart.get(inc.dataset.inc) || 0) + 1); return; }
        const dec = e.target.closest('[data-dec]'); if (dec) { setQty(dec.dataset.dec, (S.cart.get(dec.dataset.dec) || 0) - 1); return; }
        const d = e.target.closest('[data-dest]'); if (d) { pickDest(d.dataset.dest, d.dataset.label); return; }
        if (e.target.closest('#shDestChange')) { clearDest(); return; }
    });
    $('shCheckoutBtn').addEventListener('click', openCheckout);
    // "+ Tambah produk lain" -> pindah ke layar daftar produk; balik lewat tombol Checkout di bar bawah
    $('shAddMore').addEventListener('click', () => go('produk'));
    $('shShowAll').addEventListener('click', () => { S.only = ''; renderGrid(); });
    const sq = $('shSearch'); if (sq) sq.addEventListener('input', () => { S.q = sq.value.trim(); renderGrid(); });
    $('shNext').addEventListener('click', next);
    $('shBack').addEventListener('click', back);
    $('shDestQ').addEventListener('input', onDestInput);
    ['shName', 'shWa', 'shAddr'].forEach(id => $(id).addEventListener('input', saveForm));
    $('shProof').addEventListener('change', onProof);
    $('shCopy').addEventListener('click', () => { const n = (S.bank || {}).number || ''; (navigator.clipboard ? navigator.clipboard.writeText(n) : Promise.reject()).then(() => toast('Nomor rekening disalin')).catch(() => prompt('Salin nomor rekening:', n)); });
    init();
})();
