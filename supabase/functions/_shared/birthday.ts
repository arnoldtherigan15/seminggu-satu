// File terpisah (bukan digabung ke members.ts/queries.ts) khusus biar
// activeBirthdayVoucher() bisa dipake dari queries.ts (loyaltyMembers) TANPA
// bikin circular import -- members.ts sendiri udah import loyaltyMembers dari
// queries.ts, jadi kalau fungsi ini ditaruh di members.ts, queries.ts import
// balik ke members.ts bakal muter.

function jakartaTodayIso(): string {
  // "YYYY-MM-DD" di timezone Asia/Jakarta (WIB, UTC+7, no DST).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" + 1 bulan kalender (dipakai buat hitung batas akhir window
// voucher) -- pakai Date.UTC biar hasilnya nggak kegeser zona waktu server.
function addOneMonthIso(iso: string): string {
  const [y, mo, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  return dt.toISOString().slice(0, 10);
}

// SAMA PERSIS pola window-nya kayak birthdayInfo() di warga/main.js -- voucher
// ultah = umur% off, berlaku 1 BULAN PENUH sejak tanggal ultah ASLI (mis. ultah
// 17 Agustus -> berlaku sampai 17 September), BUKAN cuma bulan kalender ultah.
// Kalau naskah window-nya diubah di salah satu, ubah juga di satunya biar
// jangan sampai beda antara apa yang keliatan di /warga vs di admin. Dipake
// admin-api (getMembers -> activeVouchers, loyaltyMembers -> voucherActive)
// buat nampilin siapa aja yang vouchernya MASIH aktif SEKARANG -- beda dari
// todaysBirthdays()/todaysBirthdaysWithContact() yang cuma nangkep ultah
// PERSIS hari ini.
export function activeBirthdayVoucher(birthDate: string): { age: number; validFrom: string; validUntil: string } | null {
  const m = String(birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const birthYear = parseInt(m[1], 10);
  const monthDay = `${m[2]}-${m[3]}`;
  const todayIso = jakartaTodayIso();
  const todayYear = parseInt(todayIso.slice(0, 4), 10);

  // Cek window ultah tahun ini & tahun lalu (jaga-jaga window-nya nyebrang ke tahun baru).
  for (const y of [todayYear, todayYear - 1]) {
    const validFrom = `${y}-${monthDay}`;
    const validUntil = addOneMonthIso(validFrom);
    if (todayIso >= validFrom && todayIso < validUntil) {
      const age = y - birthYear;
      if (age > 0 && age <= 120) return { age, validFrom, validUntil };
    }
  }
  return null;
}
