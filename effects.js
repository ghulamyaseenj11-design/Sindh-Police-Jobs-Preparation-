// Scroll-reveal animations. Works for content loaded later (announcements, blogs, tests, sections).
(function () {
  var SELECTORS = [
    '.section-heading', '.info-card', '.category-card', '.option-button', '.empty-state',
    '.mt-card', '.cp-card', '.cp-more-grid a',
    '.blog-card', '.material-card', '.page-card', '.gallery-card'
  ].join(',');

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        var t = e.target; t.classList.add('fx-in'); io.unobserve(t);
        setTimeout(function () { t.style.transitionDelay = ''; }, 1200); // keep hover snappy afterwards
      }
    });
  }, { threshold: 0.12 }) : null;

  function prep(root) {
    (root.querySelectorAll ? root.querySelectorAll(SELECTORS) : []).forEach(function (el, i) {
      if (el.dataset.fx) return;
      el.dataset.fx = '1';
      if (!io) return;
      el.classList.add('fx-reveal');
      if (el.matches('.info-card,.mt-card,.cp-card,.blog-card,.material-card,.page-card')) el.classList.add('fx-left');
      el.style.transitionDelay = Math.min(i % 6, 5) * 80 + 'ms';
      io.observe(el);
    });
  }

  function badgeAnnouncements() {
    var list = document.getElementById('announcementList');
    if (!list) return;
    var first = list.children[0];
    if (first && !first.querySelector('.fx-new-badge') && first.children.length) {
      var h = first.querySelector('h1,h2,h3,h4,strong');
      if (h) { var b = document.createElement('span'); b.className = 'fx-new-badge'; b.textContent = 'NEW'; h.appendChild(b); }
    }
  }

  function run() { prep(document); badgeAnnouncements(); }
  document.addEventListener('DOMContentLoaded', function () {
    run();
    // pick up content that loads after the page (Supabase data)
    new MutationObserver(function () { run(); }).observe(document.body, { childList: true, subtree: true });
  });
})();
