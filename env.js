/**
 * ==============================================
 * ENV CONFIG — Jangan commit file ini ke GitHub!
 * ==============================================
 * File ini berisi URL Google Apps Script.
 * Sudah di-gitignore agar tidak ter-upload.
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxyh5OcWm7Jr0e196R9bg_FUPqT58uULQfWxniIUi3wfJ9KL83GkzKDeb7OB0uzI1eaDQ/exec';

// OneSignal App ID (push notification Balai Warga). Ini ID publik, aman di-commit.
// Kosong = fitur push nggak aktif. REST API key-nya JANGAN ditaruh sini —
// simpan di Apps Script > Project Settings > Script Properties (ONESIGNAL_REST_KEY).
const ONESIGNAL_APP_ID = '527347c3-909b-41f8-9a51-8a20bb3886a8';

// Supabase (migrasi backend — lihat SUPABASE-MIGRATION-PLAN.md).
// URL & Publishable key AMAN di-commit (bukan rahasia, diproteksi Row Level Security).
// JANGAN PERNAH taruh "Secret key" (yang mulai "sb_secret_...") di sini atau file lain di repo ini.
//
// Dua project terpisah biar testing nggak nyenggol data warga asli:
// - "seminggu-satu"      (PRODUCTION) -> otomatis dipakai kalau diakses via seminggusatu.com
// - "seminggu-satu-dev"  (DEV/testing) -> otomatis dipakai selain itu (localhost, file://, dst)
const _SUPABASE_IS_PROD_HOST = typeof location !== "undefined" &&
    /(^|\.)seminggusatu\.com$/.test(location.hostname || "");

const SUPABASE_URL = _SUPABASE_IS_PROD_HOST
    ? 'https://anztympwvfjgkpycgdvm.supabase.co'                 // project: seminggu-satu (production)
    : 'https://jynlksrtucububtqqpav.supabase.co';                            // project: seminggu-satu-dev

const SUPABASE_ANON_KEY = _SUPABASE_IS_PROD_HOST
    ? 'sb_publishable_u-88r-vtj5VE6D9cgz6oZg_34osylPt'            // publishable key project production
    : 'sb_publishable_u6njfYcniKbeXutghUmKjw_LciOlZEs';                        // publishable key project dev
