---
name: seminggu-ui
description: Design system & UI styling guide untuk project Seminggu Satu (situs statis + Apps Script). WAJIB dibaca sebelum bikin/ubah halaman, komponen, warna, atau layout apa pun di repo ini — biar hasilnya konsisten, modern, dan "premium" (selevel UI hasil generate Gemini), bukan polos. Trigger: bikin halaman baru, section admin/member, kartu, tombol, form, modal, empty/loading state, atau styling apa pun.
---

# Seminggu Satu — UI/Design System

Tujuan: tiap UI di repo ini kelihatan **rapi, modern, playful, dan konsisten** — bukan "form HTML mentah". Ikuti token + pola di bawah. Kalau ragu, tiru halaman yang udah bagus: `sahabat/` (Member Hub) dan `loyalty/`.

## 0) Prinsip inti (yang bikin beda "polos" vs "premium")
1. **Ruang napas** — padding card 1.1–1.75rem, gap antar elemen 0.6–1rem. Jangan mepet.
2. **Hierarki jelas** — judul tebal besar (Outfit 800), teks sekunder `--muted` lebih kecil. Satu fokus per layar.
3. **Sudut membulat + shadow lembut** — radius 12–22px, shadow biru-tipis (bukan hitam pekat).
4. **Gradient buat hero/aksi penting** — biru diagonal khas brand (lihat token).
5. **Micro-interaction** — semua tombol punya `:hover` + `:active` (transform scale .98) + `transition`.
6. **Delight** — confetti pas momen sukses (login, submit, reward), emoji secukupnya, copy Bahasa Indonesia santai ("Yuk", "kamu", "✨").
7. **Mobile-first** — target tap ≥44px; di HP navigasi tab jadi **bottom bar** (lihat `sahabat`).
8. **Selalu ada state**: loading (shimmer/spinner), empty (emoji + ajakan), error (ikon + tombol coba lagi). Jangan biarin layar kosong/blank.
9. **Theme-aware bila perlu**, tapi default brand = terang.

## 1) Design tokens (PAKAI INI, jangan warna acak)
```css
:root{
  --blue:#0046ff;      /* aksi utama, angka penting */
  --blue-2:#0092ff;
  --yellow:#ffe600;    /* aksen/CTA hangat, highlight */
  --ink:#10245e;       /* teks utama (biru gelap, bukan hitam) */
  --bg:#f4f7ff;        /* background halaman */
  --card:#ffffff;
  --line:#e4e9f5;      /* border halus */
  --muted:#6b7794;     /* teks sekunder */
}
```
- **Gradient brand**: `linear-gradient(155deg,#0043f5 0%,#0092ff 55%,#00b4ff 100%)` (hero/kartu wrapped/voucher).
- **Aksen kuning** buat highlight kecil di atas gradient (badge, angka hero).
- **Shadow**: `0 18px 45px rgba(0,60,200,.28)` (kartu gradient), `0 8px 20px rgba(0,30,120,.12)` (kartu putih menonjol). Kartu biasa cukup `1px solid var(--line)`.

## 2) Tipografi
- Heading/angka: **Outfit** 700–800. Body: **Open Sans** 400–800.
- Import: `Open+Sans:wght@400;600;700;800` + `Outfit:wght@600;700;800`.
- Reset: `*{margin:0;padding:0;box-sizing:border-box}` + `-webkit-font-smoothing:antialiased`.
- Halaman workshop lama pakai `style.css` (Inter+Outfit) — di situ pakai class `style.css` yang ada (`.submit-btn`, `.upload-area`, `.form-group`, `.input-wrapper`), JANGAN bikin class sendiri yang bentrok.

## 3) Komponen (pola siap pakai)
- **Kartu**: `background:var(--card); border:1px solid var(--line); border-radius:16px; padding:1.25rem;`
- **Kartu hero/spesial**: gradient brand + teks putih + angka hero kuning gede (Outfit 800) + orb blur dekoratif.
- **Tombol utama**: `background:var(--blue); color:#fff; border-radius:13px; padding:.85rem; font-weight:800;` + hover/active.
- **Tombol kuning (CTA hangat)**: `background:var(--yellow); color:var(--ink);`
- **Tombol ghost**: `background:var(--bg); border:1.5px solid var(--line); color:var(--ink);`
- **Badge/chip**: pill (`border-radius:999px`), warna lembut (mis. `#e9fbf0/#0a7a3d` sukses, `#fef9c3/#854d0e` info, `#fee2e2/#b91c1c` bahaya).
- **Stat card**: angka besar `--blue` (Outfit 800) + label kecil uppercase `--muted`.
- **Filter chips**: baris horizontal scroll, chip aktif = `--blue` bg putih.
- **Tab**: desktop = pill bar; **mobile = bottom nav fixed** (blur bg, ikon+label, safe-area-inset). Lihat `sahabat/`.
- **Modal**: overlay `rgba(0,0,0,.55)`, box putih radius 16px, center, padding.

## 4) State wajib
- **Loading**: shimmer skeleton (lihat `index.html` `.ws-skeleton`) atau spinner ring biru. Kasih teks ("Sebentar ya…").
- **Empty**: emoji besar + judul + 1 kalimat ajakan (contoh di `sahabat` placeholder).
- **Error**: ikon + pesan + tombol "Coba Lagi".

## 5) Delight
- **Confetti** (`canvas-confetti` CDN) pas login/submit/reward. Preset di `sahabat/main.js` (`fireConfetti`).
- **Share ke IG Story / WA**: render kartu (recap-story/voucher) jadi PNG 1080×1920 via `html2canvas` (clone off-screen 360×640, `.export` padding safe-zone, scale 3) → `navigator.share({files})` fallback download. Lihat `loyalty` (passport) & `sahabat` (leaderboard).

## 6) Aturan teknis repo (jangan dilanggar)
- Situs statis GitHub Pages + Apps Script (JSONP GET, fetch POST tanpa custom header). `Google_Script_Code.js` **gitignored + redeploy manual**.
- Path relatif dari root project. Aset self-contained bila bisa.
- Logo `logo_seminggu.png` = **transparan** (blend di bg apa pun).
- Verifikasi tiap file: `node --check` (JS) atau extract `<script>` lalu `new Function()` (HTML inline) sebelum selesai.

## 7) Checklist sebelum bilang "selesai"
- [ ] Pakai token warna & font brand (bukan default).
- [ ] Tombol ada hover + active + transition.
- [ ] Ada loading + empty + error state.
- [ ] Mobile enak (tap besar, nggak overflow horizontal, bottom nav kalau portal).
- [ ] Copy Bahasa Indonesia santai + emoji secukupnya.
- [ ] Konsisten sama `sahabat/` & `loyalty/`.
- [ ] Syntax dicek (`node --check`).
