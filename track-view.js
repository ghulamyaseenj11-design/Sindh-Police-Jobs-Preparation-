// Study with GYJ view tracking: one row per page view and per test / note open.
// Fails silently if the page_views table is not set up yet - the site keeps working.
(function () {
  var sent = {};
  function getClient() { return window.supabaseClient || null; }
  function sectionOf() {
    try {
      var q = new URLSearchParams(window.location.search);
      var s = q.get('section') || q.get('category') || '';
      if (s) return s;
      var cat = document.body && document.body.getAttribute('data-category');
      if (cat) return cat;
    } catch (e) {}
    return '';
  }
  function pageOf() {
    var p = window.location.pathname || '';
    var parts = p.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1].replace(/\.html$/, '') : 'index';
  }
  function record(section, item) {
    try {
      var key = pageOf() + '|' + (section || '') + '|' + (item || '');
      var now = Date.now();
      if (sent[key] && now - sent[key] < 60000) return;
      sent[key] = now;
      var tries = 0;
      (function attempt() {
        var client = getClient();
        if (!client) { if (++tries <= 10) setTimeout(attempt, 500); return; }
        client.from('page_views').insert({ page: pageOf(), section: section || null, item: item || null })
          .then(function () {}, function () {});
      })();
    } catch (e) {}
  }
  window.SJPView = { track: record };
  if (document.readyState === 'complete' || document.readyState === 'interactive') record(sectionOf(), null);
  else document.addEventListener('DOMContentLoaded', function () { record(sectionOf(), null); });
})();
