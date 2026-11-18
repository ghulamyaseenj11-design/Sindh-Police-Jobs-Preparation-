
// Everything shows to everyone, but opening it needs a login.
let sjpLoggedIn = false;
let sjpLoginReady = null;
function initSjpLogin() {
  if (!window.supabaseClient) return;
  sjpLoginReady = window.supabaseClient.auth.getSession().then(function (r) {
    sjpLoggedIn = !!(r.data && r.data.session);
    return sjpLoggedIn;
  }).catch(function () { return false; });
  window.supabaseClient.auth.onAuthStateChange(function (event, session) {
    sjpLoggedIn = !!session;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  injectAnimations();
  injectBottomNav();
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      mainNav.classList.toggle("open");
    });

    mainNav.addEventListener("click", event => {
      if (event.target.closest("a")) mainNav.classList.remove("open");
    });
  }

  // Department pages open only after login (the list stays visible).
  document.addEventListener("click", function (event) {
    var a = event.target && event.target.closest ? event.target.closest('a[href*="category.html"]') : null;
    if (!a) return;
    if (!sjpLoggedIn) { event.preventDefault(); window.location.href = "auth.html"; }
  });

  if (!window.supabaseClient) {
    console.error("Supabase client is unavailable. Check config.js.");
    return;
  }

  initSjpLogin();
  loadPublicWebsite();
});

async function loadPublicWebsite() {
  if (sjpLoginReady) { try { await sjpLoginReady; } catch (e) {} }
  await Promise.allSettled([
    loadSiteSettings(),
    loadNavigation(),
    loadStudyMaterials(),
    loadAnnouncements(),
    loadBlogs(),
    loadPages(),
    loadGallery()
  ]);
}

// Animations for the homepage: cards fade in, lift on hover, gallery
// images zoom slightly, and the Mock Tests button gently pulses.
function injectAnimations() {
  if (document.getElementById("cp-animations")) return;
  const style = document.createElement("style");
  style.id = "cp-animations";
  style.textContent = `@keyframes cpFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes cpPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,162,39,.55)}50%{box-shadow:0 0 0 9px rgba(201,162,39,0)}}
.info-card,.material-card,.page-card,.gallery-card{animation:cpFadeUp .55s ease both;transition:transform .25s ease,box-shadow .25s ease}
.info-card:hover,.material-card:hover,.page-card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(11,35,65,.16)}
.gallery-card img{transition:transform .3s ease}
.gallery-card img:hover{transform:scale(1.04)}
a.cp-link{display:inline-block;background:#0B2341;color:#fff!important;padding:9px 16px;border-radius:999px;font-weight:700;text-decoration:none;animation:cpPulse 2.2s infinite}`;
  document.head.appendChild(style);
}

// Bottom navigation bar inside the floating .dock, TayyarHo style: Home, MCQs, Papers, Depts,
// Profile. Links to the account page (login when logged out).
function injectBottomNav() {
  if (document.getElementById("sjp-bottomnav")) return;
  var style = document.createElement("style");
  style.id = "sjp-bottomnav-style";
  style.textContent = "#sjp-bottomnav{position:static;width:100%;max-width:560px;display:flex;background:#fff;border:1px solid rgba(11,35,65,.12);border-radius:20px;box-shadow:0 8px 24px rgba(11,35,65,.18);pointer-events:auto;padding-bottom:env(safe-area-inset-bottom,0)}"
    + "#sjp-bottomnav a,#sjp-bottomnav .sjp-bn-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0 9px;text-decoration:none;color:#5b6b82;font-size:11px;font-weight:600}"
    + "#sjp-bottomnav .sjp-bn-icon{font-size:22px;line-height:1}"
    + "#sjp-bottomnav a.sjp-bn-active{color:#C9A227}"
    + "#sjp-bottomnav .sjp-bn-item{opacity:.55}"
    + "body{padding-bottom:84px}";
  document.head.appendChild(style);
  var path = (window.location.pathname || "").toLowerCase();
  var items = [
    { icon: "🏠", label: "Home", href: "index.html", active: path === "/" || path === "" || path.endsWith("/") || path.endsWith("index.html") },
    { icon: "📝", label: "MCQs", href: "mock-tests.html", active: path.endsWith("mock-tests.html") },
    { icon: "📄", label: "Papers", href: "papers.html", active: path.endsWith("papers.html") },
    { icon: "🏛️", label: "Depts", href: "departments.html", active: path.endsWith("departments.html") || /prison-constable|eligibility|physical-test|written-test|interview/.test(path) },
    { icon: "👤", label: "Profile", href: "profile.html", active: path.endsWith("profile.html") || path.endsWith("auth.html") }
  ];
  var nav = document.createElement("nav");
  nav.id = "sjp-bottomnav";
  items.forEach(function (it) {
    var el = document.createElement(it.href ? "a" : "span");
    el.className = it.href ? (it.active ? "sjp-bn-active" : "") : "sjp-bn-item";
    if (it.href) el.href = it.href;
    var icon = document.createElement("span");
    icon.className = "sjp-bn-icon";
    icon.textContent = it.icon;
    var label = document.createElement("span");
    label.textContent = it.label;
    el.appendChild(icon);
    el.appendChild(label);
    nav.appendChild(el);
  });
  var dock = document.createElement("div");
  dock.className = "dock";
  dock.id = "sjp-bottomnav-wrap";
  dock.appendChild(nav);
  document.body.appendChild(dock);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element && value !== null && value !== undefined) {
    element.textContent = value;
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeLink(url, text, className = "") {
  const link = document.createElement("a");
  link.href = url;
  link.textContent = text;
  if (className) link.className = className;

  if (/^https?:\/\//i.test(url)) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  return link;
}

function showLoading(container, message) {
  if (container) container.textContent = message;
}

function isSafeUrl(url) {
  if (!url) return false;
  const value = String(url).trim();

  return (
    value.startsWith("/") ||
    value.startsWith("#") ||
    /^https?:\/\//i.test(value)
  );
}


// ============================================
// WEBSITE SETTINGS
// ============================================

async function loadSiteSettings() {
  const { data, error } = await window.supabaseClient
    .from("site_settings")
    .select("setting_key, setting_value");

  if (error) {
    console.error("Settings error:", error);
    return;
  }

  const settings = {};
  (data || []).forEach(item => {
    settings[item.setting_key] = item.setting_value || "";
  });

  if (settings.site_name) {
    document.title = settings.site_name + " | Preparation & Updates";
    setText("siteName", settings.site_name);
    setText("heroSiteName", settings.site_name);
    setText("footerSiteName", settings.site_name);
  }

  if (settings.about_text) {
    setText("aboutDescription", settings.about_text);
  }

  if (settings.logo_url && isSafeUrl(settings.logo_url)) {
    const logo = document.getElementById("siteLogo");
    if (logo) {
      logo.src = settings.logo_url;
      logo.alt = settings.site_name || "Website logo";
      logo.classList.remove("hidden");
    }

    const mark = document.getElementById("brandMark");
    if (mark) mark.classList.add("hidden");
  }

  if (settings.contact_number) {
    const contact = document.getElementById("footerContact");
    if (contact) {
      contact.textContent = "Contact: " + settings.contact_number;
    }
  }

  if (settings.public_email) {
    const email = document.getElementById("footerEmail");
    if (email) {
      email.textContent = settings.public_email;
      email.href = "mailto:" + settings.public_email;
    }
  }

  if (settings.whatsapp_link && isSafeUrl(settings.whatsapp_link)) {
    const whatsapp = document.getElementById("footerWhatsapp");
    if (whatsapp) {
      whatsapp.href = settings.whatsapp_link;
      whatsapp.classList.remove("hidden");
    }
  }
}


// ============================================
// DYNAMIC NAVIGATION
// ============================================

async function loadNavigation() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;

  const { data, error } = await window.supabaseClient
    .from("site_navigation")
    .select("title, url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Navigation error:", error);
    return;
  }

  if (!data || data.length === 0) return;

  nav.replaceChildren();

  data.forEach(item => {
    if (!isSafeUrl(item.url)) return;
    nav.appendChild(makeLink(item.url, item.title));
  });

  const adminLink = makeLink("admin.html", "Admin");
  nav.appendChild(adminLink);
}


// ============================================
// STUDY MATERIALS
// ============================================

async function loadStudyMaterials() {
  const list = document.getElementById("publicStudyMaterials");
  if (!list) return;

  showLoading(list, "Loading study materials...");

  const { data, error } = await window.supabaseClient
    .from("study_materials")
    .select("id, title, category, description, body, file_url, created_at")
    .eq("published", true)
    .neq("category", "Past Papers")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Study materials error:", error);
    showLoading(list, "Study materials could not be loaded.");
    return;
  }

  if (!data || data.length === 0) {
    showLoading(list, "New study materials will be published here soon.");
    return;
  }

  list.replaceChildren();

  let freshNotes = [];
  try {
    if (window.SJPAuth && SJPAuth.notifPrefs().notes && SJPAuth.hasSeen('notes')) {
      freshNotes = SJPAuth.unseenIds('notes', data.map(function (x) { return x.id; }));
    }
  } catch (e) {}

  data.forEach(item => {
    const card = makeElement("article", "info-card material-card");
    const noteTitle = makeElement("h3", "", item.title || "Study Notes");
    if (freshNotes.indexOf(item.id) !== -1) noteTitle.appendChild(makeElement("span", "new-badge", "NEW"));
    card.appendChild(noteTitle);
    card.appendChild(makeElement(
      "p",
      "muted",
      "Category: " + (item.category || "General")
    ));

    if (item.description) {
      card.appendChild(makeElement("p", "", item.description));
    }

    if (item.body) {
      const full = String(item.body);
      const shown = sjpLoggedIn || full.length <= 200 ? full : full.slice(0, 200) + "…";
      const body = makeElement("p", "material-body", shown);
      body.style.whiteSpace = "pre-wrap";
      card.appendChild(body);
      if (!sjpLoggedIn && full.length > 200) {
        card.appendChild(makeLink("auth.html", "🔒 Login to Read Full Note", "btn btn-gold"));
      }
    }

    if (item.file_url && isSafeUrl(item.file_url)) {
      const pdfLink = makeLink(item.file_url, "Open / Download PDF", "btn btn-gold");
      if (!sjpLoggedIn) {
        pdfLink.addEventListener("click", function (e) { e.preventDefault(); window.location.href = "auth.html"; });
      }
      card.appendChild(pdfLink);
    }

    list.appendChild(card);
  });

  try { if (window.SJPAuth) SJPAuth.markSeen('notes', data.map(function (x) { return x.id; })); } catch (e) {}
}


// ============================================
// ANNOUNCEMENTS
// ============================================

// An announcement can carry a link: the admin adds it as
// [LINK]url|Button text[/LINK] at the end of the details.
// The popup and the list both read it back out.
function parseAnnouncementLink(content) {
  var text = String(content || "");
  var m = text.match(/\[LINK\]([\s\S]*?)\[\/LINK\]/);
  if (!m) return { text: text, link: null, linkText: "" };
  var parts = m[1].split("|");
  return { text: text.replace(m[0], "").trim(), link: (parts[0] || "").trim(), linkText: (parts[1] || "Click here").trim() };
}

function announcementSeenIds() {
  try { return JSON.parse(localStorage.getItem("sjp_ann_popup_seen") || "[]"); } catch (e) { return []; }
}

function markAnnouncementsPopupSeen(ids) {
  try {
    var seen = announcementSeenIds();
    ids.forEach(function (id) { if (seen.indexOf(id) === -1) seen.push(id); });
    localStorage.setItem("sjp_ann_popup_seen", JSON.stringify(seen.slice(-50)));
  } catch (e) {}
}

// Fast popup styles: the overlay fades in .15s, the card pops in .25s.
function injectAnnouncementPopupStyles() {
  if (document.getElementById("sjp-ann-popup-style")) return;
  var style = document.createElement("style");
  style.id = "sjp-ann-popup-style";
  style.textContent = "@keyframes sjpAnnFade{from{opacity:0}to{opacity:1}}"
    + "@keyframes sjpAnnPop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}"
    + ".sjp-ann-overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;animation:sjpAnnFade .15s ease both}"
    + ".sjp-ann-card{background:#fff;border-radius:14px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.35);animation:sjpAnnPop .25s ease-out both;margin:auto 0}"
    + ".sjp-ann-head{background:#1a73e8;color:#fff;text-align:center;font-weight:800;font-size:1.25rem;letter-spacing:.5px;padding:14px 16px}"
    + ".sjp-ann-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px;max-height:62vh;overflow-y:auto}"
    + ".sjp-ann-item h3{margin:0 0 6px;font-size:1.15rem;color:#0B2341;text-align:center}"
    + ".sjp-ann-item p{margin:0;white-space:pre-wrap;color:#333;line-height:1.55;text-align:center}"
    + ".sjp-ann-link{display:block;text-align:center;background:#ec407a;color:#fff!important;font-weight:800;padding:11px 16px;border-radius:10px;text-decoration:none;margin-top:10px}"
    + ".sjp-ann-close{display:block;width:100%;border:0;cursor:pointer;background:#e53935;color:#fff;font:inherit;font-weight:800;font-size:1.05rem;padding:14px}";
  document.head.appendChild(style);
}

// New announcements pop up first, before the home screen, like a public
// notice. Closing it remembers the announcement, so it does not pop up
// again — a new announcement still pops up the next time.
function showAnnouncementPopup(items) {
  if (!items.length || document.getElementById("sjp-ann-overlay")) return;
  injectAnnouncementPopupStyles();
  var overlay = makeElement("div", "sjp-ann-overlay");
  overlay.id = "sjp-ann-overlay";
  var card = makeElement("div", "sjp-ann-card");
  card.appendChild(makeElement("div", "sjp-ann-head", "📢 PUBLIC NOTICE"));
  var body = makeElement("div", "sjp-ann-body");
  items.forEach(function (item) {
    var parsed = parseAnnouncementLink(item.content);
    var wrap = makeElement("div", "sjp-ann-item");
    wrap.appendChild(makeElement("h3", "", item.title || "Announcement"));
    wrap.appendChild(makeElement("p", "", parsed.text));
    if (parsed.link) {
      var a = makeElement("a", "sjp-ann-link", "👉 " + (parsed.linkText || "Click here"));
      a.href = parsed.link;
      wrap.appendChild(a);
    }
    body.appendChild(wrap);
  });
  card.appendChild(body);
  var close = makeElement("button", "sjp-ann-close", "Close");
  close.type = "button";
  close.addEventListener("click", function () {
    markAnnouncementsPopupSeen(items.map(function (x) { return x.id; }));
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  });
  card.appendChild(close);
  overlay.appendChild(card);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close.click(); });
  document.body.appendChild(overlay);
}

async function loadAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;

  showLoading(list, "Loading announcements...");

  const { data, error } = await window.supabaseClient
    .from("announcements")
    .select("id, title, content, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Announcement error:", error);
    showLoading(list, "Announcements are temporarily unavailable.");
    return;
  }

  if (!data || data.length === 0) {
    showLoading(list, "No announcements have been published yet.");
    return;
  }

  list.replaceChildren();

  let freshAnn = [];
  try {
    if (window.SJPAuth && SJPAuth.notifPrefs().announcements && SJPAuth.hasSeen('announcements')) {
      freshAnn = SJPAuth.unseenIds('announcements', data.map(function (x) { return x.id; }));
    }
  } catch (e) {}

  data.forEach(item => {
    const card = makeElement("article", "announcement-card");
    const annTitle = makeElement("h3", "", item.title || "Announcement");
    if (freshAnn.indexOf(item.id) !== -1) annTitle.appendChild(makeElement("span", "new-badge", "NEW"));
    card.appendChild(annTitle);
    var parsed = parseAnnouncementLink(item.content);
    card.appendChild(makeElement("p", "", parsed.text));
    if (parsed.link) {
      var annLink = makeElement("a", "btn btn-gold", "👉 " + (parsed.linkText || "Click here"));
      annLink.href = parsed.link;
      card.appendChild(annLink);
    }

    if (item.created_at) {
      card.appendChild(makeElement(
        "div",
        "announcement-date",
        new Date(item.created_at).toLocaleDateString()
      ));
    }

    list.appendChild(card);
  });

  // New announcements pop up first, before the home screen.
  try {
    var popupSeen = announcementSeenIds();
    var fresh = data.filter(function (x) { return popupSeen.indexOf(x.id) === -1; });
    if (fresh.length) showAnnouncementPopup(fresh);
  } catch (e) {}

  try { if (window.SJPAuth) SJPAuth.markSeen('announcements', data.map(function (x) { return x.id; })); } catch (e) {}
}


// ============================================
// BLOGS
// ============================================

async function loadBlogs() {
  const list = document.getElementById("publicBlogs");
  if (!list) return;

  showLoading(list, "Loading blogs...");

  const { data, error } = await window.supabaseClient
    .from("site_blogs")
    .select("id, title, slug, excerpt, content, image_url, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Blogs error:", error);
    showLoading(list, "Blogs could not be loaded.");
    return;
  }

  if (!data || data.length === 0) {
    showLoading(list, "New articles and blogs will appear here.");
    return;
  }

  list.replaceChildren();

  data.forEach(blog => {
    const card = makeElement("article", "info-card blog-card");

    if (blog.image_url && isSafeUrl(blog.image_url)) {
      const image = document.createElement("img");
      image.src = blog.image_url;
      image.alt = blog.title || "Blog image";
      image.loading = "lazy";
      image.className = "content-image";
      card.appendChild(image);
    }

    card.appendChild(makeElement("h3", "", blog.title || "Blog"));

    if (blog.excerpt) {
      card.appendChild(makeElement("p", "", blog.excerpt));
    }

    const details = makeElement("details", "blog-details");
    const summary = makeElement("summary", "", "Read Article");
    summary.addEventListener("click", function (e) {
      if (!sjpLoggedIn) { e.preventDefault(); window.location.href = "auth.html"; }
    });
    details.appendChild(summary);
    const content = makeElement("p", "content-text", blog.content || "");
    content.style.whiteSpace = "pre-wrap";
    details.appendChild(content);
    card.appendChild(details);

    if (window.SJPAuth) {
      try {
        const bm = makeElement("button", "btn btn-outline blog-bookmark", "");
        bm.type = "button";
        const refreshBm = function () {
          bm.textContent = SJPAuth.isBookmarked(blog.id) ? "★ Saved" : "☆ Save Blog";
        };
        refreshBm();
        bm.addEventListener("click", function () {
          if (!sjpLoggedIn) { window.location.href = "auth.html"; return; }
          SJPAuth.toggleBookmark({ id: blog.id, title: blog.title || "Blog", slug: blog.slug });
          refreshBm();
        });
        card.appendChild(bm);
        details.addEventListener("toggle", function () {
          if (details.open) SJPAuth.recordBlogRead({ id: blog.id, title: blog.title || "Blog", slug: blog.slug });
        });
      } catch (e) {}
    }

    list.appendChild(card);
  });
}


// ============================================
// PAGES
// ============================================

async function loadPages() {
  const list = document.getElementById("publicPages");
  if (!list) return;

  const { data, error } = await window.supabaseClient
    .from("site_pages")
    .select("title, slug, content, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Pages error:", error);
    showLoading(list, "Pages could not be loaded.");
    return;
  }

  if (!data || data.length === 0) {
    showLoading(list, "No additional pages have been published.");
    return;
  }

  list.replaceChildren();

  data.forEach(page => {
    const article = makeElement("article", "info-card page-card");
    article.appendChild(makeElement("h3", "", page.title || "Page"));

    const fullPage = String(page.content || "");
    const content = makeElement("p", "content-text", sjpLoggedIn || fullPage.length <= 200 ? fullPage : fullPage.slice(0, 200) + "…");
    content.style.whiteSpace = "pre-wrap";
    article.appendChild(content);
    if (!sjpLoggedIn && fullPage.length > 200) {
      article.appendChild(makeLink("auth.html", "🔒 Login to Read More", "btn btn-gold"));
    }

    list.appendChild(article);
  });
}


// ============================================
// GALLERY
// ============================================

async function loadGallery() {
  const list = document.getElementById("publicGallery");
  if (!list) return;

  const { data, error } = await window.supabaseClient
    .from("site_gallery")
    .select("title, description, image_url, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gallery error:", error);
    showLoading(list, "Gallery could not be loaded.");
    return;
  }

  if (!data || data.length === 0) {
    showLoading(list, "Gallery images will appear here soon.");
    return;
  }

  list.replaceChildren();

  data.forEach(item => {
    if (!isSafeUrl(item.image_url)) return;

    const card = makeElement("article", "gallery-card");
    const image = document.createElement("img");
    image.src = item.image_url;
    image.alt = item.title || "Gallery image";
    image.loading = "lazy";

    card.appendChild(image);

    if (item.title) {
      card.appendChild(makeElement("h3", "", item.title));
    }

    if (item.description) {
      card.appendChild(makeElement("p", "", item.description));
    }

    list.appendChild(card);
  });
}
