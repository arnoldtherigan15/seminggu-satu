// Port dari 6 blok "if/else if (data.workshopType === ...)" di doPost
// (Google_Script_Code.js). Terima pendaftaran workshop publik (TANPA login),
// upload foto/bukti bayar ke Storage, simpan ke tabel `registrations`,
// lalu kirim notif Telegram ke admin (best-effort, gagal notif != gagal daftar).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { corsHeaders, jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { waKey } from "../_shared/auth.ts";
import { notifyRegistration } from "../_shared/telegram.ts";
import { getConfigValue } from "../_shared/config.ts";
import { mergeBatchConfig } from "../_shared/batch-merge.ts";

const WORKSHOP_LABELS: Record<string, string> = {
  "3d-frame-journaling": "3D Frame Journaling",
  "paper-journal": "Paper Journal",
  "upcycle-journal": "Upcycle Journal",
  "bookmark-journal": "Bookmark Journal",
  "reka-rekat": "Reka Rekat",
  "journaling-date": "Journaling Date",
  "side-by-side": "Side by Side",
};

const yn = (v: unknown) => String(v || "").toLowerCase() === "on" || v === true;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const workshopType = String(data.workshopType || "");
    const label = WORKSHOP_LABELS[workshopType];
    if (!label) return errorResponse("Workshop Type tidak dikenali: " + workshopType);

    const admin = supabaseAdmin();

    // Batch buat workshop ini (ganti getActiveSheetName). Sekarang bisa ada
    // LEBIH DARI 1 batch `active=true` bersamaan (mis. Vol 6 & Vol 7 buka
    // bareng) -- kalau klien udah tau mau daftar ke batch yang mana, kirim
    // batchId eksplisit. Kalau nggak (halaman lama yang belum di-update),
    // fallback ke cara lama: cuma jalan kalau PERSIS 1 batch yang lagi buka.
    const batchIdParam = String(data.batchId || "").trim();
    let batch: Record<string, unknown> | null = null;
    if (batchIdParam) {
      const { data: b } = await admin
        .from("batches")
        .select("*")
        .eq("id", batchIdParam)
        .eq("workshop_type", workshopType)
        .eq("active", true)
        .maybeSingle();
      if (!b) return errorResponse("Sesi ini udah nggak buka, refresh halaman ya.");
      batch = b;
    } else {
      const { data: rows } = await admin
        .from("batches")
        .select("*")
        .eq("workshop_type", workshopType)
        .eq("active", true)
        .limit(2);
      if (!rows || rows.length === 0) batch = null;
      else if (rows.length === 1) batch = rows[0];
      else return errorResponse("Workshop ini punya beberapa sesi terbuka, pilih salah satu dulu ya.");
    }

    // Cek kuota generik per-batch -- berlaku ke SEMUA tipe workshop (dulu
    // cuma journaling-date yang divalidasi server-side, tipe lain cuma
    // dicek di UI doang). Kuota efektif = override batch kalau diisi, else
    // Config tipe workshop. Kosong/0 di dua-duanya = dianggap tanpa batas
    // (biar workshop yang emang belum pernah diisi kuotanya nggak ketutup).
    if (batch) {
      let typeConfig: Record<string, unknown> = {};
      try {
        const rows = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]");
        typeConfig = (Array.isArray(rows) ? rows : []).find((w: { id?: string }) => w?.id === workshopType) || {};
      } catch (_e) { /* abaikan, kuota dianggap tanpa batas */ }
      const merged = mergeBatchConfig(batch, typeConfig);
      if (merged.maxQuota > 0) {
        const { count } = await admin
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("batch_id", batch.id as string)
          .eq("archived", false);
        if ((count ?? 0) >= merged.maxQuota) {
          return errorResponse(`Maaf, slot sesi ini udah penuh (max ${merged.maxQuota} orang) 😢`);
        }
      }
    }

    let extra: Record<string, unknown> = {};
    let fullName = "";
    let nickname = "";
    let igUsername = "";
    let consent = false;
    let paymentUrl = "";
    let wa = String(data.whatsapp || "");

    if (workshopType === "journaling-date") {
      // Event gratis khusus member -- verifikasi member DI SERVER, jangan percaya klien
      const key = waKey(wa);
      const { data: existing } = await admin
        .from("registrations")
        .select("id")
        .eq("wa", key)
        .neq("workshop_type", "journaling-date")
        .limit(1)
        .maybeSingle();
      if (!existing) {
        return errorResponse("Nomor ini belum terdaftar sebagai warga. Yuk ikut salah satu event kami dulu ya ✨");
      }

      // Cegah dobel daftar di sesi/batch yang sama (cek kuota generik udah
      // dilakuin di atas, sebelum percabangan tipe workshop ini)
      if (batch) {
        const { data: dup } = await admin
          .from("registrations")
          .select("id")
          .eq("batch_id", batch.id as string)
          .eq("wa", key)
          .maybeSingle();
        if (dup) return errorResponse("Kamu udah kedaftar di sesi ini kok 😊 Sampai ketemu ya!");
      }

      nickname = String(data.nickname || "Sahabat");
      wa = key;
      const photos = [];
      for (const k of ["photo1Base64", "photo2Base64", "photo3Base64", "photo4Base64"]) {
        const url = await uploadBase64(admin, "journal-photos", data[k], `jd-${key}`);
        if (url) photos.push(url);
      }
      extra = { photos };
    } else if (workshopType === "3d-frame-journaling") {
      fullName = String(data.fullName || "");
      igUsername = String(data.igUsername || "");
      consent = yn(data.consentCheck);
      paymentUrl = await uploadBase64(admin, "payment-proofs", data.paymentBase64, `payment-${workshopType}`);
      const photos = [];
      for (const k of ["b64Photo1", "b64Photo2", "b64Photo3", "b64Photo4"]) {
        const url = await uploadBase64(admin, "registration-photos", data[k], `3dframe-${fullName}`);
        if (url) photos.push(url);
      }
      extra = { frame: String(data.selectedFrame || ""), photos };
    } else if (workshopType === "paper-journal") {
      fullName = String(data.fullName || "");
      igUsername = String(data.igUsername || "");
      consent = yn(data.consentCheck);
      paymentUrl = await uploadBase64(admin, "payment-proofs", data.paymentBase64, `payment-${workshopType}`);
      const charmUrl = await uploadBase64(admin, "registration-photos", data.charmBase64, `charm-${fullName}`);
      extra = {
        initial: String(data.initial || ""),
        frontCoverWord: String(data.frontCoverWord || ""),
        colorCover: String(data.colorBody || ""),
        colorFlap: String(data.colorFlap || ""),
        colorStrap: String(data.colorStrap || ""),
        charmUrl,
      };
    } else if (workshopType === "upcycle-journal") {
      fullName = String(data.fullName || "");
      igUsername = String(data.igUsername || "");
      consent = yn(data.consentCheck);
      paymentUrl = await uploadBase64(admin, "payment-proofs", data.paymentBase64, `payment-${workshopType}`);
      const charmUrl = await uploadBase64(admin, "registration-photos", data.charmBase64, `charm-${fullName}`);
      extra = {
        initial: String(data.initial || ""),
        coverType: String(data.selectedBodyBagId || ""),
        flapType: String(data.selectedFlapBagId || ""),
        colorStrap: String(data.colorStrap || ""),
        charmUrl,
      };
    } else if (workshopType === "bookmark-journal") {
      fullName = String(data.fullName || "");
      nickname = String(data.nickname || "");
      igUsername = String(data.igUsername || "");
      consent = yn(data.consentCheck);
      paymentUrl = await uploadBase64(admin, "payment-proofs", data.paymentBase64, `payment-${workshopType}`);
      const photos = [];
      for (const k of ["photo1Base64", "photo2Base64", "photo3Base64", "photo4Base64"]) {
        const url = await uploadBase64(admin, "registration-photos", data[k], `bookmark-${fullName}`);
        if (url) photos.push(url);
      }
      extra = { rantai: String(data.colorRantai || ""), pita: String(data.colorPita || ""), photos };
    } else if (workshopType === "reka-rekat") {
      fullName = String(data.fullName || "");
      nickname = String(data.nickname || "");
      igUsername = String(data.igUsername || "");
      consent = yn(data.consentCheck);
      paymentUrl = await uploadBase64(admin, "payment-proofs", data.paymentBase64, `payment-${workshopType}`);
      const photos = [];
      if (yn(data.isPrintPhoto)) {
        for (const k of ["photo1Base64", "photo2Base64", "photo3Base64", "photo4Base64"]) {
          const url = await uploadBase64(admin, "registration-photos", data[k], `rekarekat-${fullName}`);
          if (url) photos.push(url);
        }
      }
      extra = { photos };
    } else if (workshopType === "side-by-side") {
      // Parent & Kid Journal Playdate -- 1 tiket = 1 orang tua + 1 anak.
      // full_name diisi nama ORANG TUA (dia yang dikontak/bayar/masuk daftar
      // member), nama anak numpang di extra.childName.
      const parentName = String(data.parentName || "");
      fullName = parentName;
      // Nggak ada field nickname terpisah di form ini -- dipakein nama
      // orang tua juga, biar kolom Nickname (dipakai buat sapaan reminder
      // WA di admin) nggak kosong.
      nickname = parentName;
      igUsername = String(data.igUsername || "");
      consent = yn(data.consentCheck);
      paymentUrl = await uploadBase64(admin, "payment-proofs", data.paymentBase64, `payment-${workshopType}`);
      const photos = [];
      if (yn(data.isPrintPhoto)) {
        for (const k of ["photo1Base64", "photo2Base64", "photo3Base64", "photo4Base64"]) {
          const url = await uploadBase64(admin, "registration-photos", data[k], `sidebyside-${parentName}`);
          if (url) photos.push(url);
        }
      }
      extra = { childName: String(data.childName || ""), photos };
    }

    const { error: insertError } = await admin.from("registrations").insert({
      workshop_type: workshopType,
      batch_id: batch?.id ?? null,
      wa: waKey(wa) || wa,
      full_name: fullName || null,
      nickname: nickname || null,
      ig_username: igUsername || null,
      consent,
      payment_proof_url: paymentUrl || null,
      extra,
    });

    if (insertError) {
      return errorResponse("Gagal menyimpan pendaftaran: " + insertError.message, 500);
    }

    // Notif Telegram -- best-effort, kalau gagal jangan gagalin pendaftaran
    try {
      await notifyRegistration(admin, {
        workshopType,
        label,
        fullName: fullName || nickname,
        nickname: nickname || igUsername || fullName,
        whatsapp: wa,
        batchId: batch?.id,
      });
    } catch (_e) {
      // sengaja diabaikan
    }

    return jsonResponse({ status: "success", message: `Pendaftaran ${label} Berhasil` });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
