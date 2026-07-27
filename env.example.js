/**
 * ==============================================
 * ENV CONFIG TEMPLATE
 * ==============================================
 * Copy file ini jadi `env.js` lalu isi URL yang benar.
 * Jalankan: cp env.example.js env.js
 */
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';

// Supabase (migrasi backend — lihat SUPABASE-MIGRATION-PLAN.md).
// Dua project terpisah: production (dipakai di seminggusatu.com) & dev (buat testing).
const _SUPABASE_IS_PROD_HOST = typeof location !== "undefined" &&
  /(^|\.)seminggusatu\.com$/.test(location.hostname || "");

const SUPABASE_URL = _SUPABASE_IS_PROD_HOST
  ? 'YOUR_SUPABASE_PROD_PROJECT_URL_HERE'
  : 'YOUR_SUPABASE_DEV_PROJECT_URL_HERE';

const SUPABASE_ANON_KEY = _SUPABASE_IS_PROD_HOST
  ? 'YOUR_SUPABASE_PROD_PUBLISHABLE_KEY_HERE'
  : 'YOUR_SUPABASE_DEV_PUBLISHABLE_KEY_HERE';
