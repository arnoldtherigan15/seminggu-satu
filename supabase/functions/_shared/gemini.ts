// Panggil Gemini API dengan fallback otomatis ke model lain kalau model
// utama lagi kena limit/overload -- tiap model punya kuota harian terpisah,
// jadi kalau satu abis, yang lain kemungkinan masih ada jatah. Dipakai
// bareng oleh admin-api & personal-api (semua fitur "Generate dengan AI").
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

export interface GeminiCallOptions {
  imageBase64?: string;
  mimeType?: string;
  // deno-lint-ignore no-explicit-any
  responseSchema?: any;
  temperature?: number;
}

export interface GeminiCallResult {
  ok: boolean;
  text?: string;
  error?: string;
  modelUsed?: string;
}

// Status yang nunjukin "model ini lagi nggak bisa dipake" (limit/overload/error
// sementara server) -- baru buat kasus ini dicoba model berikutnya. Error lain
// (mis. request-nya sendiri yang invalid) nggak usah di-retry ke model lain.
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500;
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  opts: GeminiCallOptions = {},
): Promise<GeminiCallResult> {
  const parts: Record<string, unknown>[] = [];
  if (opts.imageBase64) {
    parts.push({ inlineData: { mimeType: opts.mimeType || "image/jpeg", data: opts.imageBase64 } });
  }
  parts.push({ text: prompt });

  const generationConfig: Record<string, unknown> = {};
  if (opts.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = opts.responseSchema;
  }
  if (opts.temperature != null) generationConfig.temperature = opts.temperature;

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        lastError = json?.error?.message || res.statusText;
        if (isRetryableStatus(res.status)) continue; // model ini lagi bermasalah -> coba yang berikutnya
        return { ok: false, error: lastError };
      }
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastError = "AI tidak mengembalikan hasil yang bisa dibaca."; continue; }
      return { ok: true, text, modelUsed: model };
    } catch (e) {
      lastError = (e as Error).message;
      // Network error dsb -- tetep coba model berikutnya sebelum nyerah total.
    }
  }
  return { ok: false, error: lastError || "Semua model AI gagal dipanggil, coba lagi nanti ya." };
}
