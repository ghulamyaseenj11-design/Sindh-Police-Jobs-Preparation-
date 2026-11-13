// Shared script for the 6 category pages. Each page sets <body data-category="slug">.
(function () {
  var CATS = {
    'prison-constable-male': { icon: '👮', title: 'Prison Constable (Male)', intro: 'Preparation resources for male candidates.', file: 'prison-constable-male.html' },
    'lady-prison-constable': { icon: '👮‍♀️', title: 'Lady Prison Constable', intro: 'Preparation resources for female candidates.', file: 'lady-prison-constable.html' },
    'eligibility':           { icon: '📋', title: 'Eligibility', intro: 'Check official recruitment notices for current criteria.', file: 'eligibility.html' },
    'physical-test':         { icon: '🏃', title: 'Physical Test', intro: 'General preparation guidance for physical tests.', file: 'physical-test.html' },
    'written-test':          { icon: '✍️', title: 'Written Test', intro: 'Subject-wise study and MCQ practice.', file: 'written-test.html' },
    'interview':             { icon: '🎤', title: 'Interview', intro: 'Interview preparation and sample questions.', file: 'interview.html' }
  };
  var TYPE_LABEL = { details: 'DETAILS', tip: '💡 TIP', trick: '⚡ TRICK' };

  var slug = document.body.getAttribute('data-category');
  var cat = CATS[slug];
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

  // Safe text -> DOM: blank line = paragraph, "- " = bullet, "## " = sub-heading. Never uses innerHTML.
  function renderContent(text) {
    var box = el('div', 'cp-text'), list = null;
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) { list = null; return; }
      var m;
      if ((m = line.match(/^[-•*]\s+(.*)$/))) {
        if (!list) { list = el('ul'); box.appendChild(list); }
        list.appendChild(el('li', null, m[1]));
      } else if ((m = line.match(/^##\s+(.*)$/))) {
        list = null; box.appendChild(el('h4', null, m[1]));
      } else {
        list = null; box.appendChild(el('p', null, line));
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
      var a = el('a', null, s.title); a.href = '#sec-' + i; side.appendChild(a);
    });
  }

  if (!cat) { main.textContent = 'Unknown page.'; return; }
  document.title = cat.title + ' | Sindh Jail Police Preparation';

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
      all = r.data || []; render();
    });
})();
