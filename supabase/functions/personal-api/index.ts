// Personal finance tracker Arnold -- GA ADA hubungannya sama bisnis
// Seminggu Satu, numpang di admin dashboard yang sama biar ga perlu
// login/hosting terpisah. Auth reuse token admin yang sama
// (requireAdminAuth) -- sama pola kayak admin-api, 1 action = 1 case.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { requireAdminAuth } from "../_shared/admin-auth.ts";
import { callGemini } from "../_shared/gemini.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const action = String(data.action || "");
    const admin = supabaseAdmin();

    try {
      await requireAdminAuth(admin, String(data.token || ""));
    } catch (e) {
      return errorResponse((e as Error).message, 401);
    }

    switch (action) {
      case "getPersonalData": {
        const [accRes, catRes, txRes, budRes, goalRes, contribRes, liabRes, liabPayRes, billRes, billPayRes] = await Promise.all([
          admin.from("personal_accounts").select("*").order("created_at", { ascending: true }),
          admin.from("personal_categories").select("*").order("created_at", { ascending: true }),
          admin.from("personal_transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
          admin.from("personal_budgets").select("*"),
          admin.from("personal_savings_goals").select("*").order("created_at", { ascending: true }),
          admin.from("personal_savings_contributions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
          admin.from("personal_liabilities").select("*").order("created_at", { ascending: true }),
          admin.from("personal_liability_payments").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
          admin.from("personal_bills").select("*").order("created_at", { ascending: true }),
          admin.from("personal_bill_payments").select("*"),
        ]);
        return jsonResponse({
          status: "success",
          accounts: accRes.data || [],
          categories: catRes.data || [],
          transactions: txRes.data || [],
          budgets: budRes.data || [],
          savingsGoals: goalRes.data || [],
          savingsContributions: contribRes.data || [],
          liabilities: liabRes.data || [],
          liabilityPayments: liabPayRes.data || [],
          bills: billRes.data || [],
          billPayments: billPayRes.data || [],
        });
      }

      case "savePersonalAccount": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        if (!name) return errorResponse("Account name is required.");
        const payload = {
          name,
          type: String(data.type || "cash"),
          initial_balance: Math.round(Number(data.initialBalance) || 0),
          color: data.color ? String(data.color) : null,
          photo_url: data.photoUrl ? String(data.photoUrl) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_accounts").update(payload).eq("id", id);
          if (error) return errorResponse("Failed to update account: " + error.message);
        } else {
          const { error } = await admin.from("personal_accounts").insert(payload);
          if (error) return errorResponse("Failed to create account: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Account saved." });
      }

      case "archivePersonalAccount": {
        const id = String(data.id || "");
        if (!id) return errorResponse("Missing account ID.");
        const { error } = await admin.from("personal_accounts").update({ archived: !!data.archived }).eq("id", id);
        if (error) return errorResponse("Failed to update account: " + error.message);
        return jsonResponse({ status: "success" });
      }

      case "deletePersonalAccount": {
        const id = String(data.id || "");
        if (!id) return errorResponse("Missing account ID.");
        const { count } = await admin.from("personal_transactions").select("id", { count: "exact", head: true })
          .or(`account_id.eq.${id},to_account_id.eq.${id}`);
        if ((count ?? 0) > 0) return errorResponse("This account still has transactions -- move/delete them first, or archive the account instead.");
        const { error } = await admin.from("personal_accounts").delete().eq("id", id);
        if (error) return errorResponse("Failed to delete account: " + error.message);
        return jsonResponse({ status: "success", message: "Account deleted." });
      }

      case "savePersonalCategory": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        const type = String(data.type || "");
        if (!name) return errorResponse("Nama kategori wajib diisi.");
        if (type !== "income" && type !== "expense") return errorResponse("Tipe kategori nggak dikenal.");
        const payload = {
          name, type,
          color: data.color ? String(data.color) : null,
          icon: data.icon ? String(data.icon) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_categories").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update kategori: " + error.message);
        } else {
          const { error } = await admin.from("personal_categories").insert(payload);
          if (error) return errorResponse("Gagal bikin kategori: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Kategori tersimpan." });
      }

      case "archivePersonalCategory": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kategori kosong.");
        const { error } = await admin.from("personal_categories").update({ archived: !!data.archived }).eq("id", id);
        if (error) return errorResponse("Gagal update kategori: " + error.message);
        return jsonResponse({ status: "success" });
      }

      case "deletePersonalCategory": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID kategori kosong.");
        const { count } = await admin.from("personal_transactions").select("id", { count: "exact", head: true }).eq("category_id", id);
        if ((count ?? 0) > 0) return errorResponse("Kategori ini masih dipakai transaksi -- ganti kategorinya dulu, atau arsipkan aja.");
        const { error } = await admin.from("personal_categories").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus kategori: " + error.message);
        return jsonResponse({ status: "success", message: "Kategori dihapus." });
      }

      case "savePersonalTransaction": {
        const id = String(data.id || "");
        const type = String(data.type || "");
        if (!["income", "expense", "transfer"].includes(type)) return errorResponse("Tipe transaksi nggak dikenal.");
        const amount = Math.round(Number(data.amount) || 0);
        if (amount <= 0) return errorResponse("Jumlah harus lebih dari 0.");
        const accountId = String(data.accountId || "");
        if (!accountId) return errorResponse("Akun wajib dipilih.");
        const date = String(data.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorResponse("Tanggal nggak valid.");

        let toAccountId: string | null = null;
        let categoryId: string | null = null;
        if (type === "transfer") {
          toAccountId = String(data.toAccountId || "");
          if (!toAccountId) return errorResponse("Akun tujuan wajib dipilih buat transfer.");
          if (toAccountId === accountId) return errorResponse("Akun asal & tujuan transfer nggak boleh sama.");
        } else {
          categoryId = data.categoryId ? String(data.categoryId) : null;
        }

        const payload = {
          date, type, amount,
          account_id: accountId,
          to_account_id: toAccountId,
          category_id: categoryId,
          note: data.note ? String(data.note).slice(0, 300) : null,
        };
        if (id) {
          // "source" sengaja NGGAK ikut di-update -- biar transaksi yang asalnya
          // dari Impor AI tetap kecatat provenance-nya walau isinya diedit manual.
          const { error } = await admin.from("personal_transactions").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update transaksi: " + error.message);
        } else {
          const source = ["screenshot", "adjustment"].includes(String(data.source)) ? String(data.source) : "manual";
          const { error } = await admin.from("personal_transactions").insert({ ...payload, source });
          if (error) return errorResponse("Gagal simpan transaksi: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Transaksi tersimpan." });
      }

      case "parseImportImage": {
        const imageBase64 = String(data.imageBase64 || "");
        const mimeType = String(data.mimeType || "image/jpeg");
        if (!imageBase64) return errorResponse("File kosong.");

        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) return errorResponse("GEMINI_API_KEY belum diset di server.");

        const catRes = await admin.from("personal_categories").select("name,type").eq("archived", false);
        const categories = catRes.data || [];
        const incomeNames = categories.filter((c) => c.type === "income").map((c) => c.name);
        const expenseNames = categories.filter((c) => c.type === "expense").map((c) => c.name);

        const prompt = `Kamu bertugas membaca dokumen keuangan yang di-upload -- bisa berupa screenshot riwayat transaksi/struk (e-wallet/bank/marketplace), ATAU file PDF rekening koran/statement bank/e-wallet yang bisa berhalaman banyak -- dan mengekstrak SEMUA transaksi yang ada di dalamnya menjadi data terstruktur. Kalau dokumennya PDF multi-halaman, baca SEMUA halaman, jangan cuma halaman pertama.

Kalau dokumennya rekening koran/statement PDF (format tabel kolom TANGGAL, KETERANGAN, MUTASI, SALDO -- gaya BCA/bank lain):
- Setiap baris mutasi adalah 1 transaksi.
- Kode "DB" nempel di sebelah nominal MUTASI artinya dana KELUAR (expense). Nominal TANPA kode "DB" (polos atau berkode "CR") artinya dana MASUK (income).
- "BIAYA ADM", "BI-FAST BIAYA TXN", atau biaya sejenis tetap dihitung transaksi expense. "BUNGA" dihitung transaksi income.
- Baris "SALDO AWAL", "SALDO AKHIR", dan baris ringkasan total (mis. "MUTASI CR"/"MUTASI DB" di footer/akhir laporan) BUKAN transaksi -- jangan dimasukin.
- Kolom KETERANGAN sering multi-baris (nama pengirim/penerima, kode referensi, dsb) -- ringkas jadi description yang jelas (mis. "Transfer dari Nurul Fatimah", "QR FMI Bintaro", "Biaya Admin Bank").
- Nominal di statement kadang pakai pemisah ribuan koma dan desimal titik (mis. "175,000.00") -- baca nilainya dengan benar, abaikan ".00" di belakang.

Untuk setiap transaksi, tentukan:
- date: tanggal transaksi format YYYY-MM-DD. Kalau tahun tidak terlihat langsung di baris transaksi tapi terlihat di header/judul dokumen di atasnya (mis. "Agustus 2026" atau periode laporan), pakai tahun itu.
- description: deskripsi singkat (nama merchant/keterangan transaksi apa adanya dari dokumen)
- amount: jumlah dalam Rupiah, angka bulat POSITIF saja (tanpa "Rp", tanpa titik/koma pemisah ribuan)
- type: "income" kalau dana MASUK (di screenshot app biasanya ditandai warna hijau / tanda "+"; di statement PDF lihat aturan DB/CR di atas), "expense" kalau dana KELUAR (di screenshot app biasanya warna hitam/merah / tanda "-")
- categoryGuess: tebak kategori yang PALING cocok dari daftar berikut (harus sama persis salah satu dari daftar sesuai tipenya, atau null kalau tidak yakin):
  Kategori income: ${JSON.stringify(incomeNames)}
  Kategori expense: ${JSON.stringify(expenseNames)}

Abaikan elemen yang bukan transaksi (judul halaman, filter, tombol navigasi, saldo berjalan, header/footer laporan, dsb). Kalau dokumen tidak berisi transaksi finansial sama sekali, kembalikan array kosong.`;

        const schema = {
          type: "OBJECT",
          properties: {
            transactions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  date: { type: "STRING" },
                  description: { type: "STRING" },
                  amount: { type: "NUMBER" },
                  type: { type: "STRING", enum: ["income", "expense"] },
                  categoryGuess: { type: "STRING", nullable: true },
                },
                required: ["date", "description", "amount", "type"],
              },
            },
          },
          required: ["transactions"],
        };

        const result = await callGemini(geminiKey, prompt, { imageBase64, mimeType, responseSchema: schema });
        if (!result.ok) return errorResponse("Gagal memproses file: " + result.error);
        // Kuota AI kepake begitu salah satu model berhasil jawab, dicatat di
        // sini terlepas dari hasil parse JSON di bawah berhasil atau nggak.
        await admin.from("ai_usage_log").insert({});
        let parsed: { transactions?: unknown };
        try {
          parsed = JSON.parse(result.text || "");
        } catch {
          return errorResponse("Gagal baca hasil dari AI.");
        }
        const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
        return jsonResponse({ status: "success", transactions });
      }

      case "getAiUsageToday": {
        // Kuota Gemini reset di tengah malam PACIFIC TIME (bukan WIB) --
        // usage_date-nya juga dihitung di zona itu (lihat add_ai_usage_log.sql),
        // biar "hari ini" di tracker ini sinkron sama kapan Google beneran reset.
        const todayPt = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
        const { count } = await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("usage_date", todayPt);
        return jsonResponse({ status: "success", count: count || 0 });
      }

      case "savePersonalBudget": {
        const categoryId = String(data.categoryId || "");
        const period = String(data.period || "");
        const amount = Math.round(Number(data.amount) || 0);
        if (!categoryId) return errorResponse("Kategori wajib dipilih.");
        if (!/^\d{4}-\d{2}$/.test(period)) return errorResponse("Periode nggak valid.");
        if (amount <= 0) return errorResponse("Jumlah harus lebih dari 0.");
        const { error } = await admin.from("personal_budgets")
          .upsert({ category_id: categoryId, period, amount }, { onConflict: "category_id,period" });
        if (error) return errorResponse("Gagal simpan budget: " + error.message);
        return jsonResponse({ status: "success", message: "Budget tersimpan." });
      }

      case "deletePersonalBudget": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID budget kosong.");
        const { error } = await admin.from("personal_budgets").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus budget: " + error.message);
        return jsonResponse({ status: "success" });
      }

      case "copyBudgetsFromPreviousMonth": {
        const period = String(data.period || "");
        if (!/^\d{4}-\d{2}$/.test(period)) return errorResponse("Periode nggak valid.");
        const [y, m] = period.split("-").map(Number);
        const prevDate = new Date(y, m - 2, 1); // m 1-indexed -> m-2 = bulan sebelumnya (0-indexed)
        const prevPeriod = prevDate.getFullYear() + "-" + String(prevDate.getMonth() + 1).padStart(2, "0");
        const { data: prevBudgets, error: fetchErr } = await admin.from("personal_budgets")
          .select("category_id,amount").eq("period", prevPeriod);
        if (fetchErr) return errorResponse("Gagal ambil budget bulan lalu: " + fetchErr.message);
        if (!prevBudgets || !prevBudgets.length) {
          return jsonResponse({ status: "success", copied: 0, message: "Nggak ada budget di bulan sebelumnya buat disalin." });
        }
        const rows = prevBudgets.map((b) => ({ category_id: b.category_id, period, amount: b.amount }));
        // ignoreDuplicates: budget yang UDAH diset manual di bulan target ga ketimpa,
        // cuma ngisi kategori yang belum ada budget-nya di bulan ini.
        const { error } = await admin.from("personal_budgets")
          .upsert(rows, { onConflict: "category_id,period", ignoreDuplicates: true });
        if (error) return errorResponse("Gagal salin budget: " + error.message);
        return jsonResponse({ status: "success", copied: rows.length, message: `${rows.length} budget disalin dari bulan lalu.` });
      }

      case "saveSavingsGoal": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        const targetAmount = Math.round(Number(data.targetAmount) || 0);
        if (!name) return errorResponse("Nama target wajib diisi.");
        if (targetAmount <= 0) return errorResponse("Target harus lebih dari 0.");
        const payload = {
          name,
          target_amount: targetAmount,
          icon: data.icon ? String(data.icon) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_savings_goals").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update target: " + error.message);
        } else {
          const { error } = await admin.from("personal_savings_goals").insert(payload);
          if (error) return errorResponse("Gagal bikin target: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Target tersimpan." });
      }

      case "archiveSavingsGoal": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID target kosong.");
        const { error } = await admin.from("personal_savings_goals").update({ archived: !!data.archived }).eq("id", id);
        if (error) return errorResponse("Gagal update target: " + error.message);
        return jsonResponse({ status: "success" });
      }

      case "deleteSavingsGoal": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID target kosong.");
        // contributions ikut kehapus otomatis (on delete cascade)
        const { error } = await admin.from("personal_savings_goals").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus target: " + error.message);
        return jsonResponse({ status: "success", message: "Target dihapus." });
      }

      case "saveSavingsContribution": {
        const id = String(data.id || "");
        const goalId = String(data.goalId || "");
        if (!goalId) return errorResponse("Target tabungan wajib dipilih.");
        const amount = Math.round(Number(data.amount) || 0);
        if (!amount) return errorResponse("Jumlah nggak boleh 0.");
        const date = String(data.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorResponse("Tanggal nggak valid.");
        const payload = {
          goal_id: goalId,
          amount,
          date,
          note: data.note ? String(data.note).slice(0, 300) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_savings_contributions").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update setoran: " + error.message);
        } else {
          const { error } = await admin.from("personal_savings_contributions").insert(payload);
          if (error) return errorResponse("Gagal simpan setoran: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Setoran tersimpan." });
      }

      case "deleteSavingsContribution": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID setoran kosong.");
        const { error } = await admin.from("personal_savings_contributions").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus setoran: " + error.message);
        return jsonResponse({ status: "success", message: "Setoran dihapus." });
      }

      case "saveLiability": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        const principalAmount = Math.round(Number(data.principalAmount) || 0);
        if (!name) return errorResponse("Nama hutang wajib diisi.");
        if (principalAmount <= 0) return errorResponse("Jumlah hutang harus lebih dari 0.");
        const payload = {
          name,
          principal_amount: principalAmount,
          icon: data.icon ? String(data.icon) : null,
          due_date: data.dueDate ? String(data.dueDate) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_liabilities").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update hutang: " + error.message);
        } else {
          const { error } = await admin.from("personal_liabilities").insert(payload);
          if (error) return errorResponse("Gagal bikin hutang: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Hutang tersimpan." });
      }

      case "archiveLiability": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID hutang kosong.");
        const { error } = await admin.from("personal_liabilities").update({ archived: !!data.archived }).eq("id", id);
        if (error) return errorResponse("Gagal update hutang: " + error.message);
        return jsonResponse({ status: "success" });
      }

      case "deleteLiability": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID hutang kosong.");
        // payments ikut kehapus otomatis (on delete cascade)
        const { error } = await admin.from("personal_liabilities").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus hutang: " + error.message);
        return jsonResponse({ status: "success", message: "Hutang dihapus." });
      }

      case "saveLiabilityPayment": {
        const id = String(data.id || "");
        const liabilityId = String(data.liabilityId || "");
        if (!liabilityId) return errorResponse("Hutang wajib dipilih.");
        const amount = Math.round(Number(data.amount) || 0);
        if (!amount) return errorResponse("Jumlah nggak boleh 0.");
        const date = String(data.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorResponse("Tanggal nggak valid.");
        const payload = {
          liability_id: liabilityId,
          amount,
          date,
          note: data.note ? String(data.note).slice(0, 300) : null,
        };
        if (id) {
          const { error } = await admin.from("personal_liability_payments").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update pembayaran: " + error.message);
        } else {
          const { error } = await admin.from("personal_liability_payments").insert(payload);
          if (error) return errorResponse("Gagal simpan pembayaran: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Pembayaran tersimpan." });
      }

      case "deleteLiabilityPayment": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID pembayaran kosong.");
        const { error } = await admin.from("personal_liability_payments").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus pembayaran: " + error.message);
        return jsonResponse({ status: "success", message: "Pembayaran dihapus." });
      }

      // Tracker tagihan bulanan berulang (KPR/internet/parkir/dst) -- checklist
      // "udah dibayar bulan ini?" doang, SENGAJA nggak nyentuh
      // personal_transactions (murni catatan, bukan pengeluaran beneran).
      case "saveBill": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        if (!name) return errorResponse("Nama tagihan wajib diisi.");
        const resetDay = Math.min(28, Math.max(1, Math.round(Number(data.resetDay)) || 25));
        const payload = {
          name,
          amount: Math.round(Number(data.amount) || 0),
          reset_day: resetDay,
          icon: data.icon ? String(data.icon) : "receipt",
        };
        if (id) {
          const { error } = await admin.from("personal_bills").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update tagihan: " + error.message);
        } else {
          const { error } = await admin.from("personal_bills").insert(payload);
          if (error) return errorResponse("Gagal bikin tagihan: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Tagihan tersimpan." });
      }

      case "deleteBill": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID tagihan kosong.");
        // riwayat centang ikut kehapus otomatis (on delete cascade)
        const { error } = await admin.from("personal_bills").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus tagihan: " + error.message);
        return jsonResponse({ status: "success", message: "Tagihan dihapus." });
      }

      // Toggle centang "udah dibayar" buat 1 periode -- checked -> insert baris
      // (unique bill_id+period_key jaga nggak dobel), unchecked -> hapus baris.
      // periodKey dihitung di frontend dari reset_day (lihat billPeriodKey()).
      case "toggleBillPaid": {
        const billId = String(data.billId || "");
        const periodKey = String(data.periodKey || "").trim();
        if (!billId || !/^\d{4}-\d{2}$/.test(periodKey)) return errorResponse("Data tagihan nggak valid.");
        if (data.paid) {
          const { error } = await admin.from("personal_bill_payments")
            .upsert({ bill_id: billId, period_key: periodKey }, { onConflict: "bill_id,period_key" });
          if (error) return errorResponse("Gagal centang tagihan: " + error.message);
        } else {
          const { error } = await admin.from("personal_bill_payments")
            .delete().eq("bill_id", billId).eq("period_key", periodKey);
          if (error) return errorResponse("Gagal batal centang: " + error.message);
        }
        return jsonResponse({ status: "success" });
      }

      case "deletePersonalTransaction": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID transaksi kosong.");
        const { error } = await admin.from("personal_transactions").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus transaksi: " + error.message);
        return jsonResponse({ status: "success", message: "Transaksi dihapus." });
      }

      case "getPersonalNotes": {
        const [notesRes, foldersRes] = await Promise.all([
          admin.from("personal_notes").select("*").order("updated_at", { ascending: false }),
          admin.from("personal_note_folders").select("*").order("name", { ascending: true }),
        ]);
        if (notesRes.error) return errorResponse("Gagal ambil notes: " + notesRes.error.message);
        if (foldersRes.error) return errorResponse("Gagal ambil folder: " + foldersRes.error.message);
        return jsonResponse({ status: "success", notes: notesRes.data || [], folders: foldersRes.data || [] });
      }

      case "savePersonalNote": {
        const id = String(data.id || "");
        const payload = {
          title: String(data.title || "").trim(),
          body_html: String(data.bodyHtml || ""),
          folder_id: data.folderId ? String(data.folderId) : null,
          updated_at: new Date().toISOString(),
        };
        if (id) {
          const { error } = await admin.from("personal_notes").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update note: " + error.message);
          return jsonResponse({ status: "success", id });
        } else {
          const { data: inserted, error } = await admin.from("personal_notes").insert(payload).select("id").single();
          if (error) return errorResponse("Gagal simpan note: " + error.message);
          return jsonResponse({ status: "success", id: inserted.id });
        }
      }

      case "deletePersonalNote": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID note kosong.");
        const { error } = await admin.from("personal_notes").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus note: " + error.message);
        return jsonResponse({ status: "success", message: "Note dihapus." });
      }

      case "savePersonalNoteFolder": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        if (!name) return errorResponse("Nama folder wajib diisi.");
        if (id) {
          const { error } = await admin.from("personal_note_folders").update({ name }).eq("id", id);
          if (error) return errorResponse("Gagal update folder: " + error.message);
          return jsonResponse({ status: "success", id });
        } else {
          const { data: inserted, error } = await admin.from("personal_note_folders").insert({ name }).select("id").single();
          if (error) return errorResponse("Gagal bikin folder: " + error.message);
          return jsonResponse({ status: "success", id: inserted.id });
        }
      }

      case "deletePersonalNoteFolder": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID folder kosong.");
        const { error } = await admin.from("personal_note_folders").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus folder: " + error.message);
        return jsonResponse({ status: "success", message: "Folder dihapus." });
      }

      default:
        return errorResponse("Aksi tidak dikenal: " + action);
    }
  } catch (e) {
    return errorResponse((e as Error).message || "Terjadi kesalahan", 500);
  }
});
