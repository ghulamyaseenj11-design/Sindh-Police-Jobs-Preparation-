// Shared script for the 6 category pages. Each page sets <body data-category="slug">.
(function () {
  // Animations for every category page: cards fade in, lift on hover,
  // and the Mock Tests button gently pulses so visitors notice it.
  (function () {
    if (document.getElementById('cp-animations')) return;
    var style = document.createElement('style');
    style.id = 'cp-animations';
    style.textContent = `@keyframes cpFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes cpPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,162,39,.55)}50%{box-shadow:0 0 0 9px rgba(201,162,39,0)}}
.cp-card{animation:cpFadeUp .55s ease both;transition:transform .25s ease,box-shadow .25s ease;scroll-margin-top:90px}
.cp-card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(11,35,65,.16)}
.cp-flash{outline:3px solid #C9A227!important;outline-offset:2px;box-shadow:0 0 0 6px rgba(201,162,39,.3)!important}
a.cp-link{display:inline-block;background:#0B2341;color:#fff!important;padding:9px 16px;border-radius:999px;font-weight:700;text-decoration:none;animation:cpPulse 2.2s infinite}
.cp-toc-card{background:linear-gradient(160deg,#0B2341 0%,#123a6e 100%)!important;border:2px solid #C9A227!important;border-radius:16px!important;padding:18px!important}
#cpToc a.cp-toc-link{display:flex;align-items:center;gap:10px;margin:8px 0;padding:12px 14px;border-radius:12px;background:linear-gradient(135deg,#ffffff,#ffeec2);color:#0B2341!important;text-decoration:none;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.25);transition:transform .2s ease,box-shadow .2s ease}
#cpToc a.cp-toc-link:active{transform:translateX(4px) scale(.98);box-shadow:0 8px 18px rgba(0,0,0,.35)}
.cp-toc-num{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:#0B2341;color:#C9A227;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
.cp-toc-arrow{margin-left:auto;color:#C9A227;font-size:22px;font-weight:800}`;
    document.head.appendChild(style);
  })();

  // Fixed bottom navigation bar, TayyarHo style: Home, MCQs, Papers, Depts,
  // Profile. Profile is shown but is not a link yet, so tapping it opens nothing.
  function injectBottomNav() {
    if (document.getElementById('sjp-bottomnav')) return;
    var style = document.createElement('style');
    style.id = 'sjp-bottomnav-style';
    style.textContent = '#sjp-bottomnav{position:fixed;left:0;right:0;bottom:0;z-index:1000;display:flex;background:#fff;border-top:1px solid rgba(11,35,65,.12);box-shadow:0 -4px 16px rgba(11,35,65,.12);padding-bottom:env(safe-area-inset-bottom,0)}'
      + '#sjp-bottomnav a,#sjp-bottomnav .sjp-bn-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0 9px;text-decoration:none;color:#5b6b82;font-size:11px;font-weight:600}'
      + '#sjp-bottomnav .sjp-bn-icon{font-size:22px;line-height:1}'
      + '#sjp-bottomnav a.sjp-bn-active{color:#C9A227}'
      + '#sjp-bottomnav .sjp-bn-item{opacity:.55}'
      + 'body{padding-bottom:64px}';
    document.head.appendChild(style);
    var path = (window.location.pathname || '').toLowerCase();
    var items = [
      { icon: '🏠', label: 'Home', href: 'index.html', active: path === '/' || path === '' || path.endsWith('/') || path.endsWith('index.html') },
      { icon: '📝', label: 'MCQs', href: 'mock-tests.html', active: path.endsWith('mock-tests.html') },
      { icon: '📄', label: 'Papers', href: 'papers.html', active: path.endsWith('papers.html') },
      { icon: '🏛️', label: 'Depts', href: 'departments.html', active: path.endsWith('departments.html') || path.endsWith('category.html') || /prison-constable|eligibility|physical-test|written-test|interview/.test(path) },
      { icon: '👤', label: 'Profile', href: null, active: false }
    ];
    var nav = document.createElement('nav');
    nav.id = 'sjp-bottomnav';
    items.forEach(function (it) {
      var item = document.createElement(it.href ? 'a' : 'span');
      item.className = it.href ? (it.active ? 'sjp-bn-active' : '') : 'sjp-bn-item';
      if (it.href) item.href = it.href;
      var icon = document.createElement('span');
      icon.className = 'sjp-bn-icon';
      icon.textContent = it.icon;
      var label = document.createElement('span');
      label.textContent = it.label;
      item.appendChild(icon);
      item.appendChild(label);
      nav.appendChild(item);
    });
    document.body.appendChild(nav);
  }
  injectBottomNav();

  // Footer quick links on every department page, so no page is a dead end:
  // Home, Mock Tests, Papers, Departments and the 4 test sections.
  // This also covers the 6 thin shell pages, which all load this script.
  (function injectFooterLinks() {
    var footer = document.querySelector('.site-footer .container');
    if (!footer || footer.querySelector('.footer-explore')) return;
    var row = document.createElement('div');
    row.className = 'footer-explore';
    [
      ['Home', 'index.html'], ['Mock Tests', 'mock-tests.html'], ['Papers', 'papers.html'],
      ['Departments', 'departments.html'],
      ['Jail Police Tests', 'mock-tests.html?section=jail-police'],
      ['Vaccinators Tests', 'mock-tests.html?section=vaccinators'],
      ['Islamabad Police Tests', 'mock-tests.html?section=islamabad-police'],
      ['PST JST Tests', 'mock-tests.html?section=pst-jst']
    ].forEach(function (pair) {
      var a = document.createElement('a');
      a.href = pair[1];
      a.textContent = pair[0];
      row.appendChild(a);
    });
    var bottom = footer.querySelector('.footer-bottom');
    if (bottom) footer.insertBefore(row, bottom); else footer.appendChild(row);
  })();

  var CATS = {
    'prison-constable-male': { icon: '👮', title: 'Prison Constable (Male)', intro: 'Preparation resources for male candidates.', file: 'prison-constable-male.html' },
    'lady-prison-constable': { icon: '👮‍♀️', title: 'Lady Prison Constable', intro: 'Preparation resources for female candidates.', file: 'lady-prison-constable.html' },
    'eligibility':           { icon: '📋', title: 'Eligibility', intro: 'Check official recruitment notices for current criteria.', file: 'eligibility.html' },
    'physical-test':         { icon: '🏃', title: 'Physical Test', intro: 'General preparation guidance for physical tests.', file: 'physical-test.html' },
    'written-test':          { icon: '✍️', title: 'Written Test', intro: 'Subject-wise study and MCQ practice.', file: 'written-test.html' },
    'interview':             { icon: '🎤', title: 'Interview', intro: 'Interview preparation and sample questions.', file: 'interview.html' },
    'jail-police':           { icon: '🚨', title: 'Jail Police', intro: 'Mock tests and preparation for Jail Police.', file: 'category.html?category=jail-police' },
    'vaccinators':           { icon: '💉', title: 'Vaccinators', intro: 'Mock tests and preparation for Vaccinators.', file: 'category.html?category=vaccinators' },
    'islamabad-police':      { icon: '🚓', title: 'Islamabad Police', intro: 'Mock tests and preparation for Islamabad Police.', file: 'category.html?category=islamabad-police' },
    'pst-jst':               { icon: '📚', title: 'PST JST', intro: 'Mock tests and preparation for PST JST.', file: 'category.html?category=pst-jst' }
  };
  var TYPE_LABEL = { details: 'DETAILS', tip: '💡 TIP', trick: '⚡ TRICK' };

  var slug = document.body.getAttribute('data-category');
  // New departments work without a code change: an unknown slug gets a
  // title derived from its name and opens through category.html?category=slug.
  var cat = CATS[slug] || (slug ? { icon: '🏛️', title: slug.split('-').map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(' '), intro: 'Preparation resources.', file: 'category.html?category=' + encodeURIComponent(slug) } : null);
  var main = document.getElementById('cpSections');
  var side = document.getElementById('cpToc');
  var filters = document.getElementById('cpFilters');
  var all = [], filter = 'all';

  document.getElementById('year').textContent = new Date().getFullYear();

  // mobile menu
  var toggle = document.getElementById('menuToggle'), nav = document.getElementById('mainNav');
  if (toggle && nav) toggle.addEventListener('click', function () {
    ['open', 'active', 'show'].forEach(function (c) { nav.classList.toggle(c); });
  });

  // "Other topics" grid
  var more = document.getElementById('cpMoreGrid');
  Object.keys(CATS).forEach(function (k) {
    if (k === slug) return;
    var a = document.createElement('a');
    a.href = CATS[k].file;
    a.textContent = CATS[k].icon + ' ' + CATS[k].title;
    more.appendChild(a);
  });

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Links in plain text become tappable: any http(s) URL is turned into a
  // real <a> element. Still no innerHTML anywhere, so no code can sneak in.
  // The Mock Tests URL shows as a short "Open Mock Tests" button text.
  function addRichText(parent, text) {
    String(text || '').split(/(https?:\/\/[^\s)]+)/g).forEach(function (part) {
      if (/^https?:\/\//.test(part)) {
        var a = document.createElement('a');
        a.href = part;
        a.textContent = /mock-tests\.html/.test(part) ? 'Open Mock Tests' : part;
        a.className = 'cp-link';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        parent.appendChild(a);
      } else if (part) {
        parent.appendChild(document.createTextNode(part));
      }
    });
  }

  // Safe text -> DOM: blank line = paragraph, "- " = bullet, "## " = sub-heading. Never uses innerHTML.
  function renderContent(text) {
    var box = el('div', 'cp-text'), list = null;
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) { list = null; return; }
      var m;
      if ((m = line.match(/^[-•*]\s+(.*)$/))) {
        if (!list) { list = el('ul'); box.appendChild(list); }
        var li = el('li');
        addRichText(li, m[1]);
        list.appendChild(li);
      } else if ((m = line.match(/^##\s+(.*)$/))) {
        list = null; box.appendChild(el('h4', null, m[1]));
      } else {
        list = null;
        var p = el('p');
        addRichText(p, line);
        box.appendChild(p);
      }
    });
    return box;
  }

  function render() {
    main.innerHTML = ''; side.innerHTML = '';
    var shown = all.filter(function (s) { return filter === 'all' || s.section_type === filter; });
    if (!shown.length) {
      var empty = el('div', 'cp-empty');
      empty.appendChild(el('span', 'cp-icon', '📖'));
      empty.appendChild(el('strong', null, all.length ? 'Nothing in this filter yet.' : 'Content coming soon'));
      empty.appendChild(el('p', null, all.length ? 'Try another filter.' : 'Notes, tips and tricks for this topic will appear here when published.'));
      main.appendChild(empty);
      return;
    }
    shown.forEach(function (s, i) {
      var card = el('article', 'cp-card ' + s.section_type);
      card.id = 'sec-' + i;
      card.appendChild(el('span', 'cp-badge', TYPE_LABEL[s.section_type] || 'DETAILS'));
      card.appendChild(el('h3', null, s.title));
      card.appendChild(renderContent(s.content));
      main.appendChild(card);
      // Colourful, touchable table-of-contents button: tap it and the page
      // smoothly scrolls to that section and flashes it gold.
      var a = el('a', 'cp-toc-link');
      a.href = '#sec-' + i;
      a.appendChild(el('span', 'cp-toc-num', String(i + 1)));
      a.appendChild(document.createTextNode(s.title));
      a.appendChild(el('span', 'cp-toc-arrow', '›'));
      a.addEventListener('click', (function (n) {
        return function (ev) {
          ev.preventDefault();
          var target = document.getElementById('sec-' + n);
          if (!target) return;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('cp-flash');
          setTimeout(function () { target.classList.remove('cp-flash'); }, 2000);
        };
      })(i));
      side.appendChild(a);
    });
  }

  if (!cat) { main.textContent = 'Unknown page.'; return; }
  document.title = cat.title + ' | Sindh Jail Police Preparation';

  // "Papers" and "Mock Tests" buttons on every department page hero.
  (function () {
    var hero = document.querySelector('.cp-hero .container');
    if (!hero || hero.querySelector('.cp-hero-actions')) return;
    var row = document.createElement('div');
    row.className = 'cp-hero-actions';
    row.style.marginTop = '14px';
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.flexWrap = 'wrap';
    var papers = document.createElement('a');
    papers.className = 'btn btn-gold';
    papers.href = 'papers.html';
    papers.textContent = '📄 Papers';
    // Mock Tests goes to THIS department's own section (Jail Police,
    // Vaccinators, Islamabad Police, PST JST); the 6 original departments
    // belong to the Jail Police section.
    var sectionSlug = (slug === 'jail-police' || slug === 'vaccinators' || slug === 'islamabad-police' || slug === 'pst-jst') ? slug : 'jail-police';
    var tests = document.createElement('a');
    tests.className = 'btn btn-outline';
    tests.href = 'mock-tests.html?section=' + sectionSlug;
    tests.textContent = '📝 Mock Tests';
    row.append(papers, tests);
    hero.appendChild(row);
  })();

  // Make the "ON THIS PAGE" box colourful: navy gradient card, gold heading.
  if (side && side.parentElement) {
    side.parentElement.classList.add('cp-toc-card');
    var tocHead = side.parentElement.querySelector('h2, h3');
    if (tocHead) { tocHead.style.color = '#C9A227'; }
  }

  filters.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-f]'); if (!b) return;
    filter = b.getAttribute('data-f');
    Array.prototype.forEach.call(filters.children, function (c) { c.classList.toggle('active', c === b); });
    render();
  });

  var client = window.supabaseClient;
  if (!client) { main.textContent = 'Content could not be loaded.'; return; }
  client.from('category_sections')
    .select('id,title,section_type,content,sort_order')
    .eq('category', slug).eq('published', true)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    .then(function (r) {
      if (r.error) { main.innerHTML = ''; main.appendChild(el('p', 'muted', 'Could not load content. Please try again later.')); return; }
      if (r.data && r.data.length) { all = r.data; render(); return; }
      // Exam departments keep their details in site_settings (dept_details_<slug>),
      // because the category_sections table only allows the 6 original names.
      client.from('site_settings')
        .select('setting_value')
        .eq('setting_key', 'dept_details_' + slug)
        .maybeSingle()
        .then(function (dr) {
          if (dr.error || !dr.data) { all = []; render(); return; }
          try {
            var secs = JSON.parse(dr.data.setting_value || '[]');
            all = secs.map(function (x) {
              return { title: x.title, section_type: x.type, content: x.content, sort_order: x.sort };
            });
          } catch (e) { all = []; }
          render();
        });
    });
})();
