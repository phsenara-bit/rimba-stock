/**
 * ============================================================================
 * SECURITY GATE — Rimba Alam Stock API
 * ============================================================================
 * Tujuan: menutup Web App dari akses publik. Tanpa token, siapa pun yang tahu
 * URL /exec bisa membaca seluruh stok + daftar PIN karyawan, dan mengirim
 * transaksi palsu ke sheet.
 *
 * CARA PASANG (3 langkah, ±2 menit):
 *   1. Di editor Apps Script, rename DUA fungsi yang sudah ada:
 *          function doGet(e)   ->  function _realDoGet(e)
 *          function doPost(e)  ->  function _realDoPost(e)
 *      Jangan ubah isinya, cuma namanya.
 *   2. Tempel SELURUH isi file ini di paling atas Code.gs.
 *   3. Project Settings -> Script Properties -> tambah baris:
 *          SYNC_TOKEN = <token rahasia>
 *      Lalu Deploy -> Manage deployments -> Edit (ikon pensil)
 *          -> Version: New version -> Deploy.
 *      (Jangan "New deployment" — URL-nya berubah dan semua HP harus diisi ulang.)
 *
 * Selama SYNC_TOKEN belum diisi, gate MENOLAK SEMUA permintaan (fail closed).
 * ============================================================================
 */

const GATE_TOKEN_PROP = "SYNC_TOKEN";

function _gateExpectedToken_() {
  return String(PropertiesService.getScriptProperties().getProperty(GATE_TOKEN_PROP) || "").trim();
}

function _gateTokenFromRequest_(e) {
  var token = "";
  if (e) {
    if (e.parameter && e.parameter.token) {
      token = e.parameter.token;
    }
    if (!token && e.postData && e.postData.contents) {
      try {
        var parsed = JSON.parse(e.postData.contents);
        if (parsed && parsed.token) token = parsed.token;
      } catch (err) {
        // body bukan JSON — biarkan token kosong
      }
    }
  }
  return String(token || "").trim();
}

function _gateSafeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function _gateDeny_(code, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, code: code, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _gateCheck_(e) {
  var expected = _gateExpectedToken_();
  if (!expected) {
    return _gateDeny_("NOT_CONFIGURED", "Server belum dikonfigurasi: isi Script Property SYNC_TOKEN di Apps Script.");
  }
  var got = _gateTokenFromRequest_(e);
  if (!got) {
    return _gateDeny_("UNAUTHORIZED", "Token sinkronisasi tidak dikirim. Buka Pengaturan aplikasi lalu isi Token Sinkronisasi.");
  }
  if (!_gateSafeEquals_(got, expected)) {
    return _gateDeny_("UNAUTHORIZED", "Token sinkronisasi salah atau sudah diganti. Minta token terbaru ke Super Admin.");
  }
  return null;
}

function doGet(e) {
  var denied = _gateCheck_(e);
  if (denied) return denied;
  return _realDoGet(e);
}

function doPost(e) {
  var denied = _gateCheck_(e);
  if (denied) return denied;
  return _realDoPost(e);
}
