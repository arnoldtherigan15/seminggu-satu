-- ============================================================
-- merge_member_wa(from_wa, to_wa) -- warga ganti nomor WA, atau
-- kedaftar lagi dengan nomor yang beda dari sebelumnya. `wa` adalah
-- primary key members DAN cuma dicocokin lewat text di semua tabel
-- lain (registrations, quest_submissions, dst -- TANPA foreign key,
-- warisan dari struktur Sheet lama), jadi ganti nomor cuma di
-- `members` bakal bikin histori (stamp loyalty, quest, post) keliatan
-- ke-reset ke 0 di nomor barunya. Function ini pindahin `wa` di SEMUA
-- tabel terkait sekaligus, atomik (1 transaksi), dipanggil dari
-- admin-api action "mergeMemberWa".
--
-- Dipakai buat 2 skenario dari admin panel (Member Hub):
--   1. "Ganti Nomor Aktif": from_wa = nomor lama member, to_wa = nomor
--      barunya -- baris `members`-nya sendiri ikut di-rename.
--   2. "Gabung Nomor Lain": from_wa = nomor lain yang kedaftar lagi,
--      to_wa = nomor aktif member yang sudah ada -- histori dari
--      from_wa digabung, tapi `members` yang sudah ada TIDAK disentuh
--      (karena from_wa biasanya belum pernah aktivasi akun).
--
-- Kalau KEDUANYA sudah punya akun member aktif (pass_hash keisi) --
-- dua identitas yang sudah "hidup" sendiri-sendiri -- function ini
-- nolak (gabung 2 akun aktif butuh keputusan manual, bukan sekali
-- klik, biar nggak ada history/password yang keinjek diam-diam).
-- ============================================================

create or replace function merge_member_wa(from_wa text, to_wa text)
returns void
language plpgsql
as $$
begin
  if from_wa is null or to_wa is null or from_wa = '' or to_wa = '' then
    raise exception 'from_wa/to_wa kosong';
  end if;
  if from_wa = to_wa then
    raise exception 'Nomor sumber dan tujuan sama.';
  end if;
  if exists (select 1 from members where wa = from_wa and pass_hash is not null)
     and exists (select 1 from members where wa = to_wa and pass_hash is not null) then
    raise exception 'Kedua nomor sudah punya akun Balai Warga aktif sendiri-sendiri -- gabungkan manual dulu.';
  end if;

  update registrations set wa = to_wa where wa = from_wa;
  update quest_submissions set wa = to_wa where wa = from_wa;
  update board_messages set wa = to_wa where wa = from_wa;
  update suggestions set wa = to_wa where wa = from_wa;
  update barter_posts set wa = to_wa where wa = from_wa;
  update mading_journal_posts set wa = to_wa where wa = from_wa;

  -- Composite-PK tables (target_id, wa) / (suggestion_id, wa) -- buang baris
  -- from_wa yang bakal bentrok sama baris to_wa yang sudah ada di target yang
  -- sama, baru pindahin sisanya (kalau nggak, UPDATE-nya bisa gagal kena
  -- unique-violation pas ketemu duplikat).
  delete from quest_likes ql
    where ql.wa = from_wa
      and exists (select 1 from quest_likes q2 where q2.wa = to_wa and q2.target_id = ql.target_id);
  update quest_likes set wa = to_wa where wa = from_wa;

  delete from suggestion_votes sv
    where sv.wa = from_wa
      and exists (select 1 from suggestion_votes s2 where s2.wa = to_wa and s2.suggestion_id = sv.suggestion_id);
  update suggestion_votes set wa = to_wa where wa = from_wa;

  -- Baris members sendiri cuma di-rename kalau from_wa yang punya akun
  -- (skenario "Ganti Nomor Aktif"). Kalau from_wa nggak punya akun sama
  -- sekali (skenario "Gabung Nomor Lain" -- cuma histori registrasi
  -- nyasar), nggak ada apa-apa buat di-rename di sini.
  if exists (select 1 from members where wa = from_wa) then
    update members set wa = to_wa where wa = from_wa;
  end if;
end;
$$;

grant execute on function merge_member_wa(text, text) to service_role;
