// Personal finance tracker Arnold -- GA ADA hubungannya sama bisnis
// Seminggu Satu, numpang di admin dashboard yang sama biar ga perlu
// login/hosting terpisah. Auth reuse token admin yang sama
// (requireAdminAuth) -- sama pola kayak admin-api, 1 action = 1 case.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { jsonResponse, errorResponse, handleOptions } from "../_shared/cors.ts";
import { requireAdminAuth } from "../_shared/admin-auth.ts";
import { callGemini } from "../_shared/gemini.ts";
import { encryptSecret, decryptSecret } from "../_shared/vault-crypto.ts";
import { uploadBase64 } from "../_shared/storage.ts";
import { getConfigValue } from "../_shared/config.ts";
import { mergeBatchConfig } from "../_shared/batch-merge.ts";
import { parseQuickTx } from "../_shared/quick-tx.ts";
import { getSettings, setSettings, tg, randomHex, isProdProject } from "../_shared/tg-finance.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const data = await req.json();
    const action = String(data.action || "");
    const admin = supabaseAdmin();

    try {
      const sess = await requireAdminAuth(admin, String(data.token || ""));
      // Keuangan pribadi, catatan, password: khusus super admin
      if (sess.role !== "super") return errorResponse("Akses khusus super admin.", 403);
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
          const source = ["screenshot", "adjustment", "quick", "bill"].includes(String(data.source)) ? String(data.source) : "manual";
          const { error } = await admin.from("personal_transactions").insert({ ...payload, source });
          if (error) return errorResponse("Gagal simpan transaksi: " + error.message);
        }
        return jsonResponse({ status: "success", message: "Transaksi tersimpan." });
      }

      // "Catat cepat": 1 kalimat -> transaksi (parser sama persis kayak bot Telegram).
      // mode "preview" cuma nebak (buat pratinjau di kolom ketik), "save" nebak
      // + simpan. overrides = koreksi manual dari chip pratinjau (akun/kategori/
      // tanggal/tipe) yang menang atas tebakan.
      case "quickTx": {
        const [accRes, catRes, histRes] = await Promise.all([
          admin.from("personal_accounts").select("id, name, type, archived"),
          admin.from("personal_categories").select("id, name, type, archived"),
          admin.from("personal_transactions").select("note, category_id, account_id, type").order("created_at", { ascending: false }).limit(400),
        ]);
        if (accRes.error || catRes.error) return errorResponse("Gagal ambil data akun/kategori.");
        const p = parseQuickTx(String(data.text || ""), { accounts: accRes.data || [], categories: catRes.data || [], history: histRes.data || [] });
        const o = (data.overrides || {}) as Record<string, string>;
        if (p.ok) {
          if (o.type && ["income", "expense", "transfer"].includes(o.type) && o.type !== p.type) { p.type = o.type as typeof p.type; if (p.type === "transfer") p.categoryId = null; }
          if (o.accountId) p.accountId = o.accountId;
          if (o.toAccountId) p.toAccountId = o.toAccountId;
          if ("categoryId" in o) p.categoryId = o.categoryId || null;
          if (o.date && /^\d{4}-\d{2}-\d{2}$/.test(o.date)) p.date = o.date;
          if (p.type === "transfer" && (!p.toAccountId || p.toAccountId === p.accountId)) { p.ok = false; p.error = "Transfer butuh akun tujuan yang beda. Tulis mis. \"bca ke gopay\"."; }
        }
        if (data.mode !== "save" || !p.ok) return jsonResponse({ status: "success", parsed: p });
        const { data: row, error } = await admin.from("personal_transactions").insert({
          date: p.date, type: p.type, amount: p.amount, account_id: p.accountId,
          to_account_id: p.type === "transfer" ? p.toAccountId : null,
          category_id: p.type === "transfer" ? null : p.categoryId,
          note: p.note ? p.note.slice(0, 300) : null, source: "quick",
        }).select("*").single();
        if (error) return errorResponse("Gagal simpan transaksi: " + error.message);
        return jsonResponse({ status: "success", parsed: p, transaction: row });
      }

      // ---------- Catat lewat Telegram ----------
      // Pakai bot notif yang udah ada (TELEGRAM_TOKEN, cuma di production).
      case "telegramStatus": {
        const st = await getSettings(admin, ["tg_chat_id", "tg_chat_name", "tg_bot_username", "cron_key", "functions_base"]);
        // siapin setting buat job pengingat (pg_cron baca dari sini) -- sekali aja
        if (!st.cron_key || st.functions_base !== Deno.env.get("SUPABASE_URL")) {
          await setSettings(admin, { cron_key: st.cron_key || randomHex(24), functions_base: Deno.env.get("SUPABASE_URL") || "" });
        }
        return jsonResponse({
          status: "success", prod: isProdProject(), tokenSet: !!Deno.env.get("TELEGRAM_TOKEN"),
          linked: !!st.tg_chat_id, chatName: st.tg_chat_name || "", botUsername: st.tg_bot_username || "",
        });
      }
      case "telegramConnect": {
        if (!isProdProject()) return errorResponse("Bot Telegram cuma aktif di production. Buka admin dari seminggusatu.com buat nyambungin.");
        if (!Deno.env.get("TELEGRAM_TOKEN")) return errorResponse("Token bot Telegram belum diset di server.");
        const me = await tg("getMe");
        if (!me.ok) return errorResponse("Bot Telegram nggak bisa dihubungi: " + (me.description || ""));
        const st = await getSettings(admin, ["tg_webhook_secret"]);
        const secret = st.tg_webhook_secret || randomHex(24);
        const hook = await tg("setWebhook", {
          url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-finance`, secret_token: secret,
          allowed_updates: ["message", "callback_query"], drop_pending_updates: true,
        });
        if (!hook.ok) return errorResponse("Gagal pasang webhook: " + (hook.description || ""));
        await tg("setMyCommands", { commands: [
          { command: "hariini", description: "Catatan hari ini" }, { command: "bulanini", description: "Ringkasan bulan ini" },
          { command: "saldo", description: "Saldo semua akun" }, { command: "batal", description: "Batalin catatan terakhir" },
          { command: "bantuan", description: "Contoh cara catat" },
        ] });
        const code = randomHex(8);
        await setSettings(admin, { tg_webhook_secret: secret, tg_link_code: code, tg_link_exp: String(Date.now() + 15 * 60 * 1000), tg_bot_username: me.result.username || "" });
        return jsonResponse({ status: "success", botUsername: me.result.username, link: `https://t.me/${me.result.username}?start=${code}` });
      }
      case "telegramDisconnect": {
        // webhook-nya dibiarin (bot notif tetap jalan), cuma chat-nya yang di-unlink
        await setSettings(admin, { tg_chat_id: null, tg_chat_name: null, tg_link_code: null, tg_link_exp: null });
        return jsonResponse({ status: "success" });
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

        // Bukti bayar (foto struk/transfer) -- private bucket, sama pola
        // kayak payment-proofs registrasi workshop. Cuma di-set kalau ada
        // foto BARU yang diupload -- kalau nggak, biarin field ini apa
        // adanya (jangan sampai edit pembayaran yang lain nge-wipe bukti
        // yang udah keupload sebelumnya).
        let proofUrl: string | undefined;
        if (data.proofBase64) {
          try {
            proofUrl = await uploadBase64(admin, "payment-proofs", data.proofBase64, "liability-payment");
          } catch (e) {
            return errorResponse("Gagal upload bukti bayar: " + (e as Error).message);
          }
        }

        const payload: Record<string, unknown> = {
          liability_id: liabilityId,
          amount,
          date,
          note: data.note ? String(data.note).slice(0, 300) : null,
        };
        if (proofUrl !== undefined) payload.payment_proof_url = proofUrl;

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
        // paid + createTx -> sekalian catat pengeluaran (kategori Tagihan) dan
        // simpan transaction_id-nya. Batal bayar -> transaksi itu ikut dihapus.
        const billId = String(data.billId || "");
        const periodKey = String(data.periodKey || "").trim();
        if (!billId || !/^\d{4}-\d{2}$/.test(periodKey)) return errorResponse("Data tagihan nggak valid.");
        if (data.paid) {
          let txId: string | null = null;
          if (data.createTx) {
            const { data: bill } = await admin.from("personal_bills").select("name, amount").eq("id", billId).maybeSingle();
            const amount = Math.round(Number(data.amount) || Number(bill?.amount) || 0);
            const accountId = String(data.accountId || "");
            if (!bill) return errorResponse("Tagihannya nggak ketemu.");
            if (amount <= 0) return errorResponse("Jumlah bayar harus lebih dari 0.");
            if (!accountId) return errorResponse("Pilih akun yang dipakai bayar.");
            const { data: cats } = await admin.from("personal_categories").select("id, name").eq("type", "expense").eq("archived", false);
            const cat = (cats || []).find((c: { name: string }) => /tagihan|langganan/i.test(c.name));
            const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
            const { data: tx, error: te } = await admin.from("personal_transactions").insert({
              date: /^\d{4}-\d{2}-\d{2}$/.test(String(data.date || "")) ? String(data.date) : today,
              type: "expense", amount, account_id: accountId, category_id: cat ? cat.id : null,
              note: String(bill.name).slice(0, 300), source: "bill",
            }).select("id").single();
            if (te) return errorResponse("Gagal nyatet pengeluaran: " + te.message);
            txId = tx.id;
          }
          const { error } = await admin.from("personal_bill_payments")
            .upsert({ bill_id: billId, period_key: periodKey, transaction_id: txId }, { onConflict: "bill_id,period_key" });
          if (error) return errorResponse("Gagal centang tagihan: " + error.message);
        } else {
          const { data: pay } = await admin.from("personal_bill_payments").select("transaction_id").eq("bill_id", billId).eq("period_key", periodKey).maybeSingle();
          const { error } = await admin.from("personal_bill_payments")
            .delete().eq("bill_id", billId).eq("period_key", periodKey);
          if (error) return errorResponse("Gagal batal centang: " + error.message);
          if (pay && pay.transaction_id) await admin.from("personal_transactions").delete().eq("id", pay.transaction_id);
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

      // ---------- Kalender admin ----------
      // 1 panggilan = 3 sumber dalam rentang [from, to] (YYYY-MM-DD):
      //  - events : batch Seminggu Satu yang tanggal event-nya kena rentang
      //             (otomatis, read-only, diturunin dari tabel batches + config)
      //  - agenda : personal_agenda (kegiatan di luar Seminggu Satu)
      //  - tasks  : task yang punya tenggat & belum selesai
      case "getCalendar": {
        const iso = /^\d{4}-\d{2}-\d{2}$/;
        const from = String(data.from || ""), to = String(data.to || "");
        if (!iso.test(from) || !iso.test(to) || from > to) return errorResponse("Rentang tanggal nggak valid.");

        const [agRes, batchRes, taskRes] = await Promise.all([
          admin.from("personal_agenda").select("*").lte("start_date", to)
            .or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`)
            .order("start_date", { ascending: true }),
          admin.from("batches").select("*").eq("archived", false),
          admin.from("tasks").select("id, title, due_date, status").neq("status", "done").gte("due_date", from).lte("due_date", to),
        ]);
        if (agRes.error) return errorResponse("Gagal ambil agenda: " + agRes.error.message);
        if (batchRes.error) return errorResponse("Gagal ambil event: " + batchRes.error.message);

        let cfg: Record<string, unknown>[] = [];
        try { cfg = JSON.parse((await getConfigValue(admin, "WORKSHOPS_JSON")) || "[]"); } catch (_e) { /* abaikan */ }
        const cfgByType = new Map(cfg.map((w) => [String(w.id || ""), w]));
        const events: Record<string, unknown>[] = [];
        for (const b of batchRes.data || []) {
          const typeConfig = (cfgByType.get(b.workshop_type) || {}) as Record<string, unknown>;
          const m = mergeBatchConfig(b, typeConfig);
          const day = m.eventDateIso ? String(m.eventDateIso).slice(0, 10) : "";
          if (!day || day < from || day > to) continue;
          events.push({
            batchId: b.id, workshopType: b.workshop_type, workshopName: typeConfig.name || b.workshop_type,
            label: m.label, date: day, time: m.workshopTime || "", location: m.locationName || "",
            maxQuota: m.maxQuota || null, active: !!m.active,
          });
        }
        // jumlah pendaftar per batch -- 1 query, bukan 1 per batch
        if (events.length) {
          const { data: regs } = await admin.from("registrations").select("batch_id")
            .in("batch_id", events.map((e) => e.batchId as string)).eq("archived", false);
          const cnt = new Map<string, number>();
          for (const r of regs || []) cnt.set(r.batch_id, (cnt.get(r.batch_id) || 0) + 1);
          for (const e of events) e.count = cnt.get(e.batchId as string) || 0;
        }
        return jsonResponse({ status: "success", agenda: agRes.data || [], events, tasks: taskRes.error ? [] : (taskRes.data || []) });
      }

      case "saveAgendaItem": {
        const id = String(data.id || "");
        const iso = /^\d{4}-\d{2}-\d{2}$/, hm = /^\d{2}:\d{2}$/;
        const title = String(data.title || "").trim();
        const startDate = String(data.startDate || "");
        const endDate = data.endDate ? String(data.endDate) : null;
        if (!title) return errorResponse("Judul agenda wajib diisi.");
        if (!iso.test(startDate)) return errorResponse("Tanggal mulai wajib diisi.");
        if (endDate && (!iso.test(endDate) || endDate < startDate)) return errorResponse("Tanggal selesai harus sama atau setelah tanggal mulai.");
        const startTime = data.startTime && hm.test(String(data.startTime)) ? String(data.startTime) : null;
        const endTime = startTime && data.endTime && hm.test(String(data.endTime)) ? String(data.endTime) : null;
        const COLORS = ["", "blue", "yellow", "pink", "green", "orange", "purple"];
        const payload = {
          title, start_date: startDate, end_date: endDate && endDate !== startDate ? endDate : null,
          start_time: startTime, end_time: endTime,
          location: String(data.location || "").trim().slice(0, 200),
          note: String(data.note || "").trim().slice(0, 2000),
          color: COLORS.includes(String(data.color || "")) ? String(data.color || "") : "",
          updated_at: new Date().toISOString(),
        };
        if (id) {
          const { error } = await admin.from("personal_agenda").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update agenda: " + error.message);
          return jsonResponse({ status: "success", id });
        }
        const { data: ins, error } = await admin.from("personal_agenda").insert(payload).select("id").single();
        if (error) return errorResponse("Gagal simpan agenda: " + error.message);
        return jsonResponse({ status: "success", id: ins.id });
      }

      case "deleteAgendaItem": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID agenda kosong.");
        const { error } = await admin.from("personal_agenda").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus agenda: " + error.message);
        return jsonResponse({ status: "success" });
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
        // Update PARSIAL: cuma field yang dikirim yang diubah -- biar pin /
        // ganti ikon dari daftar nggak ngehapus isi catatan, dan autosave
        // editor nggak nimpa pin. updated_at cuma maju kalau ISI berubah
        // (judul/isi/folder), bukan pas pin/ikon/warna doang.
        const id = String(data.id || "");
        const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
        const NOTE_COLORS = ["", "blue", "yellow", "pink", "green", "orange", "purple"];
        const payload: Record<string, unknown> = {};
        let contentChanged = false;
        if (has("title")) { payload.title = String(data.title || "").trim(); contentChanged = true; }
        if (has("bodyHtml")) { payload.body_html = String(data.bodyHtml || ""); contentChanged = true; }
        if (has("folderId")) { payload.folder_id = data.folderId ? String(data.folderId) : null; contentChanged = true; }
        if (has("icon")) payload.icon = String(data.icon || "").slice(0, 16);
        if (has("color")) payload.color = NOTE_COLORS.includes(String(data.color || "")) ? String(data.color || "") : "";
        if (has("pinned")) payload.pinned = !!data.pinned;
        if (has("noteDate")) payload.note_date = /^\d{4}-\d{2}-\d{2}$/.test(String(data.noteDate || "")) ? String(data.noteDate) : null;
        if (contentChanged || !id) payload.updated_at = new Date().toISOString();
        if (id) {
          if (!Object.keys(payload).length) return jsonResponse({ status: "success", id });
          const { data: row, error } = await admin.from("personal_notes").update(payload).eq("id", id).select("id, updated_at").single();
          if (error) return errorResponse("Gagal update note: " + error.message);
          return jsonResponse({ status: "success", id, updatedAt: row && row.updated_at });
        } else {
          const { data: inserted, error } = await admin.from("personal_notes").insert(payload).select("id, updated_at").single();
          if (error) {
            // catatan harian tanggal itu udah ada (mis. dibikin dari device lain)
            if ((error as { code?: string }).code === "23505") return errorResponse("Catatan harian buat tanggal ini udah ada. Muat ulang dulu ya.");
            return errorResponse("Gagal simpan note: " + error.message);
          }
          return jsonResponse({ status: "success", id: inserted.id, updatedAt: inserted.updated_at });
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
        const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);
        const name = String(data.name || "").trim();
        const payload: Record<string, unknown> = {};
        if (has("name") || !id) {
          if (!name) return errorResponse("Nama folder wajib diisi.");
          payload.name = name;
        }
        if (has("icon")) payload.icon = String(data.icon || "").slice(0, 16);
        if (has("parentId")) {
          const parentId = data.parentId ? String(data.parentId) : null;
          if (parentId && id) {
            // cegah folder masuk ke dirinya sendiri / turunannya (bikin lingkaran)
            const { data: all, error: e1 } = await admin.from("personal_note_folders").select("id, parent_id");
            if (e1) return errorResponse("Gagal cek folder: " + e1.message);
            const parentOf = new Map((all || []).map((f: { id: string; parent_id: string | null }) => [f.id, f.parent_id]));
            let cur: string | null = parentId;
            for (let i = 0; cur && i < 100; i++) {
              if (cur === id) return errorResponse("Folder nggak bisa dipindah ke dalam dirinya sendiri.");
              cur = parentOf.get(cur) ?? null;
            }
          }
          payload.parent_id = parentId;
        }
        if (id) {
          const { error } = await admin.from("personal_note_folders").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update folder: " + error.message);
          return jsonResponse({ status: "success", id });
        } else {
          const { data: inserted, error } = await admin.from("personal_note_folders").insert(payload).select("id").single();
          if (error) return errorResponse("Gagal bikin folder: " + error.message);
          return jsonResponse({ status: "success", id: inserted.id });
        }
      }

      case "deletePersonalNoteFolder": {
        // Isi folder (catatan + subfolder) naik ke folder induknya, bukan
        // ikut kehapus / jadi yatim.
        const id = String(data.id || "");
        if (!id) return errorResponse("ID folder kosong.");
        const { data: f, error: e0 } = await admin.from("personal_note_folders").select("parent_id").eq("id", id).maybeSingle();
        if (e0) return errorResponse("Gagal ambil folder: " + e0.message);
        const parent = f ? f.parent_id : null;
        const { error: e1 } = await admin.from("personal_notes").update({ folder_id: parent }).eq("folder_id", id);
        if (e1) return errorResponse("Gagal mindahin catatan: " + e1.message);
        const { error: e2 } = await admin.from("personal_note_folders").update({ parent_id: parent }).eq("parent_id", id);
        if (e2) return errorResponse("Gagal mindahin subfolder: " + e2.message);
        const { error } = await admin.from("personal_note_folders").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus folder: " + error.message);
        return jsonResponse({ status: "success", message: "Folder dihapus." });
      }

      // Vault password pribadi Arnold -- password disimpan TERENKRIPSI
      // (encryptSecret/decryptSecret, AES-256-GCM pakai VAULT_KEY server-side),
      // didekripsi cuma di sini pas mau ditampilin ke admin sendiri.
      case "getPersonalPasswords": {
        const { data, error } = await admin.from("personal_passwords").select("*").order("title", { ascending: true });
        if (error) return errorResponse("Gagal ambil password: " + error.message);
        const passwords = [];
        for (const row of data || []) {
          let password = "";
          try { password = await decryptSecret(row.password_encrypted); } catch (_e) { password = ""; }
          passwords.push({
            id: row.id,
            title: row.title,
            username: row.username || "",
            password,
            url: row.url || "",
            notes: row.notes || "",
            updatedAt: row.updated_at,
          });
        }
        return jsonResponse({ status: "success", passwords });
      }

      case "savePersonalPassword": {
        const id = String(data.id || "");
        const title = String(data.title || "").trim();
        const password = String(data.password || "");
        if (!title) return errorResponse("Title/service name is required.");
        if (!password) return errorResponse("Password is required.");
        let passwordEncrypted: string;
        try {
          passwordEncrypted = await encryptSecret(password);
        } catch (e) {
          return errorResponse("Gagal enkripsi password: " + (e as Error).message);
        }
        const payload = {
          title,
          username: data.username ? String(data.username).trim() : null,
          password_encrypted: passwordEncrypted,
          url: data.url ? String(data.url).trim() : null,
          notes: data.notes ? String(data.notes).trim() : null,
          updated_at: new Date().toISOString(),
        };
        if (id) {
          const { error } = await admin.from("personal_passwords").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update password: " + error.message);
          return jsonResponse({ status: "success", id });
        } else {
          const { data: inserted, error } = await admin.from("personal_passwords").insert(payload).select("id").single();
          if (error) return errorResponse("Gagal simpan password: " + error.message);
          return jsonResponse({ status: "success", id: inserted.id });
        }
      }

      case "deletePersonalPassword": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID password kosong.");
        const { error } = await admin.from("personal_passwords").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus password: " + error.message);
        return jsonResponse({ status: "success", message: "Password dihapus." });
      }

      // Video Links -- daftar link video (YouTube/Vimeo/dst) Arnold mau
      // ditonton nanti, dikelompokkin per folder (pola sama kayak Personal
      // Notes: getPersonalNotes/savePersonalNote/savePersonalNoteFolder).
      case "getPersonalVideoLinks": {
        const [linksRes, foldersRes] = await Promise.all([
          admin.from("personal_video_links").select("*").order("created_at", { ascending: false }),
          admin.from("personal_video_folders").select("*").order("name", { ascending: true }),
        ]);
        if (linksRes.error) return errorResponse("Gagal ambil video links: " + linksRes.error.message);
        if (foldersRes.error) return errorResponse("Gagal ambil folder: " + foldersRes.error.message);
        return jsonResponse({ status: "success", links: linksRes.data || [], folders: foldersRes.data || [] });
      }

      case "saveVideoLink": {
        const id = String(data.id || "");
        const url = String(data.url || "").trim();
        if (!url) return errorResponse("Link video wajib diisi.");
        if (!/^https?:\/\//i.test(url)) return errorResponse("Link harus diawali http:// atau https://");
        const payload = {
          url,
          title: data.title ? String(data.title).trim() : null,
          folder_id: data.folderId ? String(data.folderId) : null,
          notes: data.notes ? String(data.notes).trim() : null,
          updated_at: new Date().toISOString(),
        };
        if (id) {
          const { error } = await admin.from("personal_video_links").update(payload).eq("id", id);
          if (error) return errorResponse("Gagal update link: " + error.message);
          return jsonResponse({ status: "success", id });
        } else {
          const { data: inserted, error } = await admin.from("personal_video_links").insert(payload).select("id").single();
          if (error) return errorResponse("Gagal simpan link: " + error.message);
          return jsonResponse({ status: "success", id: inserted.id });
        }
      }

      case "deleteVideoLink": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID link kosong.");
        const { error } = await admin.from("personal_video_links").delete().eq("id", id);
        if (error) return errorResponse("Gagal hapus link: " + error.message);
        return jsonResponse({ status: "success", message: "Link dihapus." });
      }

      case "saveVideoFolder": {
        const id = String(data.id || "");
        const name = String(data.name || "").trim();
        if (!name) return errorResponse("Nama folder wajib diisi.");
        if (id) {
          const { error } = await admin.from("personal_video_folders").update({ name }).eq("id", id);
          if (error) return errorResponse("Gagal update folder: " + error.message);
          return jsonResponse({ status: "success", id });
        } else {
          const { data: inserted, error } = await admin.from("personal_video_folders").insert({ name }).select("id").single();
          if (error) return errorResponse("Gagal bikin folder: " + error.message);
          return jsonResponse({ status: "success", id: inserted.id });
        }
      }

      case "deleteVideoFolder": {
        const id = String(data.id || "");
        if (!id) return errorResponse("ID folder kosong.");
        const { error } = await admin.from("personal_video_folders").delete().eq("id", id);
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
