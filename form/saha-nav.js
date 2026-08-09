/* ============================================================
   SAHA Nav — tombol "pulang" sesuai PERAN (role-aware)
   ------------------------------------------------------------
   ATURAN (ditetapkan Adib, 2026-08-09):
     • admin / me / manager / pm  -> Dashboard Utama  ( ../ )
     • pl                          -> Portal PL       ( portal.html )
     • KD / belum login            -> TIDAK ADA link internal
                                      (cukup "← Kembali" ke halaman
                                       yang tadi dia buka)
   ------------------------------------------------------------
   Cara pakai di halaman:
     <span data-saha-home></span>            <- slot; diisi otomatis
     <script src="saha-nav.js" defer></script>
   ------------------------------------------------------------
   Catatan keamanan: peran yang dibaca di sini HANYA untuk tampilan
   tombol. Akses data tetap dijaga Firestore rules, jadi walau ada
   yang mengubah cache di localStorage, dia tetap tidak bisa membuka
   data yang bukan haknya — halaman tujuan tetap minta login.
   ============================================================ */
(function () {
  var CACHE_KEY = 'saha_ctx';
  var MAX_AGE = 12 * 60 * 60 * 1000; // 12 jam

  var DEST = {
    internal: { href: '../',          label: '🏠 Dashboard Utama' },
    pl:       { href: 'portal.html',  label: '🧭 Portal PL' }
  };
  var INTERNAL = ['admin', 'me', 'manager', 'pm'];

  function destFor(role) {
    role = String(role || '').toLowerCase();
    if (INTERNAL.indexOf(role) >= 0) return DEST.internal;
    if (role === 'pl') return DEST.pl;
    return null; // KD / belum login
  }

  function render(role) {
    var slots = document.querySelectorAll('[data-saha-home]');
    if (!slots.length) return;
    var d = destFor(role);
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (!d) { s.innerHTML = ''; s.style.display = 'none'; continue; }
      s.style.display = '';
      var a = document.createElement('a');
      a.setAttribute('href', d.href);
      a.textContent = d.label;
      if (!a.style.color) a.style.color = 'inherit';
      a.style.textDecoration = 'none';
      a.style.fontWeight = '700';
      s.innerHTML = '';
      s.appendChild(a);
    }
  }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.role && (Date.now() - (c.t || 0) < MAX_AGE)) return c.role;
    } catch (e) {}
    return null;
  }
  function writeCache(role) {
    try {
      if (role) localStorage.setItem(CACHE_KEY, JSON.stringify({ role: role, t: Date.now() }));
      else localStorage.removeItem(CACHE_KEY);
    } catch (e) {}
  }

  function start() { render(readCache()); verify(); }

  /* Verifikasi sebenarnya ke Firebase (async, tidak memblokir tampilan). */
  async function verify() {
    try {
      var appMod  = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
      var authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      var fsMod   = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      var apps = appMod.getApps ? appMod.getApps() : [];
      var app = apps.length ? apps[0] : appMod.initializeApp({
        apiKey: "AIzaSyC7127G5fsZprEGfeiqLrRqevTg6Qs2fko",
        authDomain: "sadar-hati-hub.firebaseapp.com",
        projectId: "sadar-hati-hub",
        storageBucket: "sadar-hati-hub.firebasestorage.app",
        messagingSenderId: "576423718259",
        appId: "1:576423718259:web:76600bbdf4f06892b36906"
      });
      authMod.onAuthStateChanged(authMod.getAuth(app), async function (u) {
        if (!u) { writeCache(null); render(null); return; }
        var role = '';
        try {
          var snap = await fsMod.getDoc(fsMod.doc(fsMod.getFirestore(app), 'roles', u.uid));
          if (snap.exists()) role = String(snap.data().role || '').toLowerCase();
        } catch (e) {}
        writeCache(role);
        render(role);
      });
    } catch (e) {
      /* offline / import gagal -> biarkan hasil cache saja */
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
