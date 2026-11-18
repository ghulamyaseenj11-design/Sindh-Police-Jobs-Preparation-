/* SJPAuth — user accounts for Study with GYJ.
   Signup and login run on Supabase Auth (the same login system the admin
   panel already uses). The profile name and photo live in the account's
   user_metadata. Activity (recently viewed notes, reading history,
   bookmarks) and notification prefs live in this browser's local storage,
   with the notification prefs also saved on the account. */
(function () {
  if (window.SJPAuth) return;

  var LS = {
    recent: 'sjp_recent_notes',
    history: 'sjp_reading_history',
    bookmarks: 'sjp_bookmarks',
    notif: 'sjp_notif_prefs',
    seen: 'sjp_seen_ids'
  };
  var DEFAULT_NOTIF = { announcements: true, notes: true, tests: true };

  function lsGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function client() { return window.supabaseClient || null; }

  async function getSession() {
    var c = client();
    if (!c) return null;
    try {
      var r = await c.auth.getSession();
      return r.data.session || null;
    } catch (e) { return null; }
  }
  async function getUser() {
    var s = await getSession();
    return s ? s.user : null;
  }
  function displayName(user) {
    if (!user) return '';
    var n = user.user_metadata && user.user_metadata.name;
    if (n) return n;
    return (user.email || '').split('@')[0];
  }
  function avatarUrl(user) {
    return (user && user.user_metadata && user.user_metadata.avatar_url) || '';
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    var first = parts[0].charAt(0);
    var second = parts.length > 1 ? parts[1].charAt(0) : '';
    return (first + second).toUpperCase();
  }

  // ---- My Activity (this browser) ----
  function pushCapped(key, item, cap, keyField) {
    var list = lsGet(key, []).filter(function (x) { return x[keyField] !== item[keyField]; });
    list.unshift(item);
    lsSet(key, list.slice(0, cap));
    return list;
  }
  function recordRecentNote(note) {
    if (!note || !note.id) return;
    pushCapped(LS.recent, { id: note.id, title: note.title || 'Study Note', category: note.category || '', at: Date.now() }, 10, 'id');
  }
  function recordBlogRead(blog) {
    if (!blog || !blog.id) return;
    pushCapped(LS.history, { id: blog.id, title: blog.title || 'Blog', slug: blog.slug || '', at: Date.now() }, 20, 'id');
  }
  function getRecentNotes() { return lsGet(LS.recent, []); }
  function getReadingHistory() { return lsGet(LS.history, []); }
  function getBookmarks() { return lsGet(LS.bookmarks, []); }
  function isBookmarked(id) {
    return getBookmarks().some(function (b) { return b.id === id; });
  }
  function toggleBookmark(blog) {
    if (!blog || !blog.id) return false;
    var list = getBookmarks();
    var i = -1;
    for (var k = 0; k < list.length; k++) if (list[k].id === blog.id) { i = k; break; }
    if (i >= 0) list.splice(i, 1);
    else list.unshift({ id: blog.id, title: blog.title || 'Blog', slug: blog.slug || '', at: Date.now() });
    lsSet(LS.bookmarks, list);
    return i < 0;
  }
  function removeBookmark(id) {
    lsSet(LS.bookmarks, getBookmarks().filter(function (b) { return b.id !== id; }));
  }

  // ---- Notification prefs (saved on the account + this browser) ----
  function notifPrefs() {
    var saved = lsGet(LS.notif, null);
    if (saved) return Object.assign({}, DEFAULT_NOTIF, saved);
    return Object.assign({}, DEFAULT_NOTIF);
  }
  async function saveNotifPrefs(prefs) {
    prefs = Object.assign({}, DEFAULT_NOTIF, prefs || {});
    lsSet(LS.notif, prefs);
    var u = await getUser();
    var c = client();
    if (u && c) {
      try { await c.auth.updateUser({ data: { notif: prefs } }); } catch (e) {}
    }
    return prefs;
  }
  async function loadNotifPrefs() {
    var u = await getUser();
    var fromAccount = (u && u.user_metadata && u.user_metadata.notif) || {};
    var prefs = Object.assign({}, DEFAULT_NOTIF, fromAccount, lsGet(LS.notif, {}));
    lsSet(LS.notif, prefs);
    return prefs;
  }

  // ---- "What's new" seen sets ----
  function hasSeen(kind) {
    var seen = lsGet(LS.seen, {});
    return (seen[kind] || []).length > 0;
  }
  function unseenIds(kind, ids) {
    var seen = lsGet(LS.seen, {});
    var set = {};
    (seen[kind] || []).forEach(function (id) { set[id] = true; });
    return (ids || []).filter(function (id) { return id && !set[id]; });
  }
  function markSeen(kind, ids) {
    var seen = lsGet(LS.seen, {});
    var set = {};
    (seen[kind] || []).forEach(function (id) { set[id] = true; });
    (ids || []).forEach(function (id) { if (id) set[id] = true; });
    seen[kind] = Object.keys(set).slice(-300);
    lsSet(LS.seen, seen);
  }
  function isFresh(dateStr, days) {
    if (!dateStr) return false;
    var t = new Date(dateStr).getTime();
    return !isNaN(t) && (Date.now() - t) < days * 86400000;
  }

  // ---- Header: Login button, or the logged-in user's chip ----
  async function renderHeaderAuth() {
    var wrap = document.querySelector('.site-header .nav-wrap');
    if (!wrap || document.getElementById('sjp-auth-btn')) return;
    var user = null;
    try { user = await getUser(); } catch (e) {}
    var a = document.createElement('a');
    a.id = 'sjp-auth-btn';
    if (user) {
      a.href = 'profile.html';
      a.className = 'sjp-auth-user';
      a.title = 'My Account';
      var av = avatarUrl(user);
      if (av) {
        var img = document.createElement('img');
        img.src = av;
        img.alt = '';
        img.className = 'sjp-avatar';
        a.appendChild(img);
      } else {
        var sp = document.createElement('span');
        sp.className = 'sjp-avatar sjp-avatar-initials';
        sp.textContent = initials(displayName(user));
        a.appendChild(sp);
      }
      var nm = document.createElement('span');
      nm.className = 'sjp-auth-name';
      nm.textContent = displayName(user);
      a.appendChild(nm);
    } else {
      a.href = 'auth.html';
      a.className = 'btn btn-gold sjp-auth-login';
      a.textContent = 'Login';
    }
    wrap.appendChild(a);
  }

  window.SJPAuth = {
    getSession: getSession,
    getUser: getUser,
    displayName: displayName,
    avatarUrl: avatarUrl,
    initials: initials,
    recordRecentNote: recordRecentNote,
    recordBlogRead: recordBlogRead,
    getRecentNotes: getRecentNotes,
    getReadingHistory: getReadingHistory,
    getBookmarks: getBookmarks,
    isBookmarked: isBookmarked,
    toggleBookmark: toggleBookmark,
    removeBookmark: removeBookmark,
    notifPrefs: notifPrefs,
    saveNotifPrefs: saveNotifPrefs,
    loadNotifPrefs: loadNotifPrefs,
    hasSeen: hasSeen,
    unseenIds: unseenIds,
    markSeen: markSeen,
    isFresh: isFresh,
    renderHeaderAuth: renderHeaderAuth
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeaderAuth);
  } else {
    renderHeaderAuth();
  }

  // Password-reset links land on any page: send them to auth.html with the
  // login token kept in the address, so the new-password form can use it.
  if (window.location.hash && window.location.hash.indexOf('type=recovery') !== -1 &&
      !/auth\.html$/.test(window.location.pathname)) {
    window.location.replace('auth.html' + window.location.hash);
  }
})();
