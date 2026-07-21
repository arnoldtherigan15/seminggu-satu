# Member Hub — Rencana Eksekusi Bertahap
_Seminggu Satu by Arnold_

Dokumen ini rencana buat membangun **ekosistem member**: event khusus member (Journaling Date), portal member (login), side quest / journaling challenge, dan gamifikasi. Dikerjain **per fase** biar tiap fase bisa dites & dipakai sebelum lanjut.

---

## 🎯 Visi
Bikin member makin loyal & aktif lewat:
- **Journaling Date by Seminggu Satu** — sesi journaling intim (max 6 org), gratis, khusus member.
- **Member Hub** — halaman login khusus member: loyalty, event berjalan, rekomendasi, side quest.
- **Side Quest** — challenge journaling bertema; member ikut dgn upload foto spread + share ke WA.
- **Gamifikasi** — poin, badge, level biar seru & bikin ketagihan.

---

## ✅ Keputusan (FIXED)
1. **Definisi "member"** = nomor WA-nya pernah kedaftar di **minimal 1 event berbayar** (data loyalty).
2. **Journaling Date gratis TIDAK nambah stamp loyalty** → sheet-nya dikecualikan dari perhitungan loyalty.
3. **Login member** pakai **No. WA + password**. Pertama kali set password + tanggal lahir; selanjutnya auto-login (token di browser).
4. **Nama event**: "Journaling Date by Seminggu Satu".
5. **Journaling Date tetap ada upload foto** (kayak reka-rekat), TANPA transfer & TANPA isi nama (auto dari data member).
6. **Member Hub** di route **`/sahabat`**.
7. **Side quest**: boleh **beberapa challenge aktif** sekaligus.
8. **Share side quest** → ke **grup WhatsApp komunitas**.
9. **Foto side quest**: **privat** (cuma buat tracking, nggak dipajang publik).
10. Tanggal lahir diisi saat registrasi → buat **reminder ultah** (Fase 7).

---

## 🏗️ Prinsip Arsitektur
- **Reuse infra yang ada**: sistem batch (sheet auto), loyalty (`loyaltyMembers_`), CONTENT_DEFS, pola JSONP + POST, admin dashboard.
- **Backend** = Google Apps Script (`Google_Script_Code.js`, gitignore, **redeploy manual** tiap ada perubahan backend).
- **Frontend** = halaman statis di GitHub Pages, config dari server (single source).
- **Keamanan**: password di-**hash** (SHA-256 + salt), TIDAK pernah simpan plaintext. Endpoint member butuh **token** valid.

---

## 🗂️ Data Model (sheet baru)
| Sheet | Kolom | Fungsi |
|---|---|---|
| `members` | `wa` (key), `nickname`, `birthDate`, `passHash`, `salt`, `token`, `createdAt`, `lastLogin` | **Akun member disimpan di Google Sheet ini** & sesi login |

### 🔗 Password DISIMPAN di sheet `members`, connect ke data member
- **Nomor WA = kunci penghubung.** Baris di `members` nyambung ke semua data member lewat `wa`: loyalty, riwayat event, side quest, poin — semua di-lookup pakai nomor WA yang sama (`waKey_`).
- **Password disimpan sebagai HASH, bukan teks asli** (`passHash = SHA256(salt + password)`).
  - Kenapa hash? Kalau nanti sheet bocor/ke-share, password asli **tetap aman & nggak kebaca**. Ini standar keamanan — bahkan bank pun nggak simpan password mentah.
  - Konsekuensinya: admin **nggak bisa "ngintip" password** member (cuma bisa **reset**). Ini justru bagus & aman.
  - Kalau kamu tetap mau bisa lihat/simpan password mentah, itu bisa TAPI berisiko (kalau sheet bocor, semua akun member bahaya) — **nggak disarankan**. Bilang aja kalau tetap mau.
| `journaling-date` (via batch) | sama seperti sheet event lain + `photoUrl` | Pendaftaran Journaling Date (tiap sesi = 1 batch) |
| `challenges` | `id`, `theme`, `title`, `desc`, `points`, `active`, `createdAt` | Side quest (dikelola admin) |
| `quest_submissions` | `id`, `challengeId`, `wa`, `nickname`, `photoUrl`, `timestamp` | Partisipasi side quest |
| `points` (opsional / computed) | `wa`, `points`, `badges` | Skor gamifikasi (bisa dihitung on-the-fly) |

> Catatan: `journaling-date` dibikin sebagai **workshop-type baru** → sheet-nya **otomatis** kebikin saat buka sesi baru dari admin. Nggak perlu bikin manual.

---

## 🔐 Model Autentikasi Member (Fase 0)
Alur:
1. **Cek WA** → backend verifikasi nomor = member (pernah ikut event). Kalau bukan → tolak halus ("khusus alumni event").
2. **Set profil + password** (pertama kali) → isi **tanggal lahir** + bikin password → simpan `birthDate` + `passHash = SHA256(salt + password)`.
3. **Login** (berikutnya) → verifikasi hash → backend balikin **token acak** (disimpan di `members.token` + localStorage browser).
4. **Auto-login** → token di localStorage dipakai tiap buka; backend validasi token.
5. **Lupa password** → v1: reset dari admin. (v2: verifikasi via WA.)

Endpoint: `memberCheckWa`, `memberSetPassword`, `memberLogin`, `memberSession` (validasi token), `memberLogout`.

Praktik aman:
- Hash + salt per user; jangan simpan plaintext.
- Token acak panjang (bukan tebakan); bisa di-revoke (ganti kolom token).
- Semua endpoint data member wajib token valid.
- (Nice-to-have) batasi percobaan login.

---

## 🎮 Desain Gamifikasi (garis besar, detail di Fase 4)
- **Poin (XP)**: +hadir event, +selesai side quest (poin per challenge diset admin).
- **Badge**: milestone — "Quest Pertama", "5 Quest", "Semua Tema", "Streak 3 Bulan", dll.
- **Level/Tier**: lanjutan dari tier passport (Pendatang Baru → … → Dewa Journaling) + jalur quest.
- **Streak**: bulan berturut-turut aktif (ikut event / quest).
- **Leaderboard** (opsional): top partisipan, **nickname only** (privasi), bisa opt-in.

---

# 🚦 FASE EKSEKUSI

Tiap fase = deliverable yang bisa dites sendiri. Backend berubah → **redeploy Apps Script**.

## Fase 1 — Journaling Date (event member gratis) ⭐ mulai di sini
**Kenapa duluan:** paling konkret, nilai langsung, reuse batch system.
- [ ] Backend: daftar workshop-type `journaling-date` (WORKSHOP_SHEETS + config).
- [ ] Backend: endpoint `memberCheckWa` (verifikasi member + balikin nickname) — reuse loyalty.
- [ ] Backend: endpoint daftar gratis → verifikasi member, cek kuota (max 6), cegah dobel daftar, simpan (timestamp, wa, nickname, foto), balikin link grup WA.
- [ ] Frontend: halaman `/journaling-date/` — input WA → verifikasi → detail sesi + upload foto → 1-tap daftar → sukses.
- [ ] Admin: kelola sesi (buka sesi baru = batch baru, set tanggal/tema/kuota, lihat pendaftar) — sebagian besar udah ada.
- **Tes:** member daftar, non-member ditolak, kuota 6 mentok, foto masuk Drive, nongol di admin + loyalty.

## Fase 0/2 — Member Hub: Login + Shell
**Fondasi portal.** (Bisa barengan/after Fase 1.)
- [ ] Sheet `members` + endpoint auth (checkWa, setPassword, login, session, logout).
- [ ] Halaman `/sahabat/` — layar login (WA → password / set password) + auto-login token.
- [ ] Shell dashboard dengan tab kosong: Loyalty · Event · Rekomendasi · Side Quest.
- **Tes:** daftar akun baru, login, refresh tetap login, logout, non-member ditolak.

## Fase 3 — Isi Member Hub (section read-only)
- [ ] **Loyalty**: tampil kartu loyalty + passport (reuse data loyalty).
- [ ] **Event Berjalan**: promo event yg lagi buka (dari config + counts) → link daftar.
- [ ] **Rekomendasi**: tampil isi `recommendation.html` (reuse CONTENT_DEFS `recommendation`).
- **Tes:** tiap section nampilin data benar untuk member yg login.

## Fase 4 — Side Quest / Journaling Challenge
- [ ] Sheet `challenges` + `quest_submissions`.
- [ ] Admin: bikin/edit/aktifkan challenge (tema, judul, deskripsi, poin).
- [ ] Member Hub: lihat challenge aktif → upload foto spread → **tombol share ke WhatsApp** → submit (tercatat).
- [ ] Backend: simpan submission + foto ke Drive; cegah dobel per challenge (opsional).
- **Tes:** admin bikin challenge, member submit + share, data masuk, keliatan di admin.

## Fase 5 — Gamifikasi
- [ ] Hitung poin (event + quest) + badge + level.
- [ ] Tampilkan di Member Hub (progress, badge, level).
- [ ] (Opsional) Leaderboard nickname-only.
- **Tes:** poin/badge update setelah ikut event & quest.

## Fase 6 — Polish
- [ ] Reset password dari admin.
- [ ] Notifikasi (Telegram admin saat ada submission/daftar).
- [ ] Analitik ringan (jumlah partisipan quest, dll).

## Fase 7 — Reminder Ulang Tahun 🎂
- [ ] Simpan `birthDate` member (dari registrasi awal — lihat Fase 0/2).
- [ ] Admin: section "🎂 Ultah bulan ini" (list member yg ultah + tombol ucapin via WA, reuse click-to-chat).
- [ ] (Opsional) Reminder otomatis: tiap pagi cek ultah hari itu → kirim notif Telegram ke admin (pakai time-based trigger Apps Script).
- [ ] (Opsional) Ucapan otomatis nggak dianjurkan (biar tetap personal) — cukup reminder ke admin.

---

## 🔗 Dependensi antar fase
```
Fase 1 (Journaling Date) ── berdiri sendiri
Fase 0/2 (Login+Shell) ── fondasi utk Fase 3,4,5
        └─ Fase 3 (sections) 
        └─ Fase 4 (side quest) ── data utk → Fase 5 (gamifikasi)
```

## ❓ Open Questions (perlu jawaban sebelum Fase terkait)
1. Konfirmasi 6 asumsi di atas (khususnya: login pakai password? free event nambah stamp?).
2. Member Hub mau di route `/member/` atau nama lain (mis. `/hub/`, `/ruang/`)?
3. Side quest: 1 challenge aktif dalam satu waktu, atau boleh beberapa sekaligus?
4. Share ke WA di side quest: share ke **grup komunitas** atau ke **kontak admin** atau share sheet biasa (pilih sendiri)?
5. Foto side quest: publik (bisa dipajang di galeri) atau privat (cuma buat tracking)?

---

_Rekomendasi urutan mulai: **Fase 1** (cepat, konkret) → **Fase 0/2** (login) → seterusnya._
