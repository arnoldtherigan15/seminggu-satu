---
name: seminggu-psych
description: Prinsip psikologi & neurosains yang WAJIB dipakai buat mikirin fitur apapun di Seminggu Satu — besar maupun kecil. WAJIB dibaca sebelum desain/bikin fitur baru (streak, reward, notifikasi, leaderboard, mood tracker, quest, apapun yang nyentuh perilaku/emosi warga). Trigger: brainstorm fitur baru, ubah mekanisme engagement yang udah ada, atau nulis copy yang nyentuh emosi/motivasi warga. Dipakai BARENGAN seminggu-ui (skill itu ngurusin tampilannya, skill ini ngurusin "kenapa"-nya).
---

# Seminggu Satu — Psikologi & Neurosains di Balik Fitur

Seminggu Satu bukan cuma aplikasi journaling — ini komunitas nyata isinya orang beneran, dan di antara mereka ada yang lagi berjuang sama anxiety, depresi, atau hal berat lainnya. Setiap fitur yang dibikin di sini — sekecil apapun (warna badge, wording notifikasi, cara streak dihitung) — nyentuh perasaan orang beneran. Jadi setiap fitur harus punya alasan psikologis yang jelas kenapa dia BANTU, bukan cuma "biar rame"/"biar engagement naik"/gimmick kosong.

## 0) Pertanyaan wajib sebelum bikin/ubah fitur apapun

Sebelum nulis kode, jawab dulu 3 ini (boleh singkat, tapi jangan dilewatin):

1. **Fitur ini bikin warga ngerasa apa, beneran?** (didengar? diakui usahanya? terhubung sama orang lain? punya kontrol? atau malah dikejar-kejar/dibanding-bandingin?)
2. **Kalau warga GAGAL/BOLONG pake fitur ini (skip minggu, streak putus, kalah di leaderboard) — reaksi sistemnya bikin dia makin cemas/ngerasa gagal, atau tetep ngerasa aman buat balik lagi?**
3. **Kalau ini dihapus besok, ada yang beneran kehilangan sesuatu yang bermakna? Atau cuma kehilangan "gamification" doang?** Kalau jawabannya cuma yang kedua, itu tanda fiturnya gimmick — desain ulang.

## 1) Prinsip inti yang jadi pegangan

**Expressive writing (riset Pennebaker & psikologi ekspresif)** — nulis soal pengalaman/perasaan, walau nggak sempurna atau nggak dibaca orang lain, terbukti bantu proses emosi & kurangin rumination. Artinya: fitur journaling di sini harus rendah-friksi buat MULAI nulis (nggak perlu sempurna, nggak perlu bagus, nggak perlu ditonton), bukan berat ke arah "biar keliatan estetik di publik".

**Self-Determination Theory (Deci & Ryan)** — motivasi yang tahan lama datang dari 3 hal: **autonomi** (ngerasa ini pilihan sendiri, bukan dipaksa sistem), **kompetensi** (ngerasa berkembang/mampu, bukan dibanding-bandingin sama orang lain), **keterhubungan** (ngerasa jadi bagian komunitas beneran). Tiap fitur reward/engagement, cek: dia nguatin salah satu dari 3 ini, atau malah gantiin motivasi intrinsik itu jadi sekadar ngejar poin (yang riset justru nunjukkin bisa NGURANGIN motivasi asli begitu reward-nya hilang — "overjustification effect")?

**Validasi emosi, bukan toxic positivity** — orang dengan anxiety/depresi sering ngerasa nggak divalidasi kalau sistem cuma nawarin "semangat!"/emoji ceria pas mereka lagi berat. Fitur mood/cuaca hati ("hujan", "badai") harus DITERIMA apa adanya — jangan ada elemen UI yang "ngoreksi" atau bikin bersalah kalau moodnya nggak "cerah". Diterima itu sendiri udah terapeutik (lihat: prinsip validasi emosi di ACT/DBT).

**Belonging yang genuine, bukan metrik kosong** — like, jumlah pengikut, ranking — semua ini gampang jadi perbandingan sosial yang bikin cemas (apalagi buat orang yang udah rentan). Kalau ada fitur sosial (leaderboard, likes, komentar), desain supaya fokusnya ke "ini orangnya beneran ada & berkarya" bukan "siapa yang menang". Rayain USAHA & kehadiran, bukan cuma ranking.

**Kebiasaan yang sehat, bukan kompulsif (behavior design yang bertanggung jawab)** — cue-routine-reward itu powerful, tapi bisa dipakai buat bikin kebiasaan sehat (nulis journal tiap minggu) ATAU buat bikin orang kompulsif checking app. Bedanya: kebiasaan sehat itu ada "titik selesai" yang jelas & bikin lega, bukan infinite scroll/loop yang nggak ada abisnya buat narik balik user.

## 2) Red flags — pola yang HARUS dihindari

- **Streak yang nge-punish, bukan ngerayain.** Streak putus jangan pernah diperlakukan kayak "kegagalan" (badge merah, pesan nyindir, dsb). Boleh nunjukkin progress, tapi jangan sampe bikin orang skip journaling minggu itu MALAH JADI TAMBAH CEMAS, dan akhirnya kabur dari app sepenuhnya. Selalu kasih jalan gampang buat "mulai lagi" tanpa rasa bersalah.
- **FOMO/urgency yang dipaksain.** ("Buruan sebelum kehabisan!", countdown timer palsu, dsb) — ini teknik dark pattern, bukan hal yang cocok buat aplikasi wellbeing.
- **Perbandingan sosial yang nggak perlu.** Leaderboard boleh ada (udah ada & itu oke, karena sifatnya opt-in & fun buat sebagian orang), tapi jangan ditambahin variasi baru yang lebih agresif (misal: "kamu kalah dari 40 orang", notifikasi "si X udah ngalahin km").
- **Notifikasi berbasis rasa bersalah.** ("Kamu udah 3 minggu nggak journaling 😢") — ganti pendekatannya jadi ajakan hangat, bukan sindiran ("Kangen cerita mingguanmu — nulis kapan aja kamu siap ya 💙").
- **Reward yang gantiin makna asli.** Hadiah/poin boleh ada sebagai bonus manis, tapi jangan sampe jadi SATU-SATUNYA alasan orang journaling — pastikan selalu ada pengingat "kenapa" di baliknya (proses reflektifnya sendiri).
- **Gimmick tanpa fungsi.** Confetti/animasi/emoji itu bagus (lihat seminggu-ui), TAPI cuma di momen yang beneran berarti (submit pertama, milestone asli) — bukan ditaburin di mana-mana biar "keliatan hidup".

## 3) Contoh penerapan di fitur yang udah ada (buat kalibrasi)

- **Cuaca Hati (mood tracker)** — udah bagus arahnya: nggak nge-judge pilihan mood apapun. Jaga ini — jangan pernah tambahin elemen yang bikin salah satu pilihan mood (hujan/badai) berasa "kurang diinginkan" dibanding yang lain.
- **Weekly Journal Tracker + streak** — pastikan bolong 1 minggu nggak reset semuanya jadi nol dengan cara yang bikin putus asa; framing-nya harus "lanjut dari sini", bukan "mulai dari nol lagi karena kamu gagal".
- **Kotak Surat Mochi** — bagus karena personal & nggak publik/dibanding-bandingin — pertahanin sifat privat-nya, jangan diubah jadi sesuatu yang dipamerin ke orang lain.
- **Loyalty stamp & voucher ulang tahun** — reward konkret yang independen dari "performa" journaling (bukan "journal paling rajin dapat lebih banyak") — ini bagus, jangan diubah jadi kompetitif.
- **Leaderboard/Quest poin** — udah opt-in secara natural (cuma keliatan kalau orangnya aktif ikutan), pertahanin biar nggak jadi tekanan buat yang nggak sengaja pengen ikutan.

## 4) Checklist sebelum ship

- [ ] Udah jawab 3 pertanyaan di bagian 0
- [ ] Nggak ada mekanisme yang "menghukum" warga karena absen/gagal/kalah
- [ ] Bahasa/copy-nya validasi perasaan apa adanya, bukan maksa positif
- [ ] Kalau ada elemen sosial (ranking/like/komentar), fokusnya ke kehadiran & usaha, bukan cuma menang-kalah
- [ ] Fiturnya tetep punya makna walau reward/gamification-nya dicabut
- [ ] Nggak ada dark pattern (urgency palsu, notifikasi rasa bersalah, dst)

## 5) Batasan penting

Seminggu Satu itu komunitas & ruang journaling — **bukan pengganti terapi atau layanan kesehatan mental profesional**, dan jangan pernah desain fitur yang seolah-olah mengklaim itu (misal: fitur yang "mendiagnosis" mood/kondisi seseorang). Kalau suatu saat ada permintaan fitur yang nyentuh area "warga lagi dalam krisis" (self-harm, dsb), stop dulu dan diskusiin langsung sama Arnold — itu bukan area yang boleh diselesaikan cuma dengan asumsi desain UI, perlu jalur eskalasi ke bantuan profesional/manusia beneran, bukan otomatisasi.
