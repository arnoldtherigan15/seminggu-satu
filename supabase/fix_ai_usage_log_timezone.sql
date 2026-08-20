-- ============================================================
-- ai_usage_log.usage_date awalnya dihitung di WIB (Asia/Jakarta), tapi
-- kuota Gemini beneran reset di tengah malam PACIFIC TIME -- salah zona
-- bikin tracker "sisa berapa kali lagi" bisa nunjukin kuota seger
-- padahal Google belom reset (atau sebaliknya), ~15 jam meleset.
-- ============================================================
alter table ai_usage_log
  alter column usage_date set default ((now() at time zone 'America/Los_Angeles')::date);
