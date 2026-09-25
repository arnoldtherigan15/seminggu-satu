// Endpoint PUBLIK (tanpa auth) -- dipake debt.html buat nampilin progress
// cicilan hutang ke orang yang Arnold utangin, lewat link acak
// (personal_liabilities.public_token) yang Arnold share manual. SENGAJA
// nggak pake requireAdminAuth (justru itu intinya -- orang lain yang nggak
// punya akses admin bisa liat), tapi gerbangnya tetep aman karena token-nya
// UUID acak (nggak bisa ditebak) dan cuma ngasih tau data hutang yang
// SPESIFIK itu doang -- bukan data finance Arnold yang lain.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const url = new URL(req.url);
    const token = req.method === "GET" ? (url.searchParams.get("token") || "") : String((await req.json()).token || "");
    if (!token) return errorResponse("Link tidak valid.", 404);

    const admin = supabaseAdmin();
    const { data: liab } = await admin.from("personal_liabilities").select("*").eq("public_token", token).maybeSingle();
    if (!liab) return errorResponse("Link tidak ditemukan atau sudah tidak berlaku.", 404);

    const { data: paymentsRaw } = await admin
      .from("personal_liability_payments")
      .select("*")
      .eq("liability_id", liab.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    const payments = paymentsRaw || [];

    // Bukti bayar disimpen sebagai "bucket/path" (private) -- generate signed
    // URL sementara di sini, di server, biar pengunjung link publik nggak
    // butuh login buat liat fotonya. Halaman ini di-fetch LIVE tiap dibuka
    // (bukan link statis ke gambar), jadi expiry pendek nggak masalah --
    // dibuat ulang tiap kunjungan.
    const paymentsWithProof = await Promise.all(payments.map(async (p) => {
      let proofUrl = "";
      if (p.payment_proof_url) {
        const idx = String(p.payment_proof_url).indexOf("/");
        if (idx > 0) {
          const bucket = p.payment_proof_url.slice(0, idx);
          const key = p.payment_proof_url.slice(idx + 1);
          try {
            const { data: signed } = await admin.storage.from(bucket).createSignedUrl(key, 600);
            proofUrl = signed?.signedUrl || "";
          } catch (_e) { /* abaikan -- tampilin tanpa foto */ }
        }
      }
      return { date: p.date, amount: Number(p.amount) || 0, note: p.note || "", proofUrl };
    }));

    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const principalAmount = Number(liab.principal_amount) || 0;
    const remaining = Math.max(0, principalAmount - totalPaid);

    return jsonResponse({
      status: "success",
      name: liab.name,
      icon: liab.icon || "receipt",
      dueDate: liab.due_date || "",
      principalAmount,
      totalPaid,
      remaining,
      cleared: remaining <= 0,
      payments: paymentsWithProof,
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
