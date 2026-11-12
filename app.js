
document.addEventListener("DOMContentLoaded", () => {
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

  if (!window.supabaseClient) {
    console.error("Supabase client is unavailable. Check config.js.");
    return;
  }

  loadPublicWebsite();
});

async function loadPublicWebsite() {
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

  data.forEach(item => {
    const card = makeElement("article", "info-card material-card");
    card.appendChild(makeElement("h3", "", item.title || "Study Notes"));
    card.appendChild(makeElement(
      "p",
      "muted",
      "Category: " + (item.category || "General")
    ));

    if (item.description) {
      card.appendChild(makeElement("p", "", item.description));
    }

    if (item.body) {
      const body = makeElement("p", "material-body", item.body);
      body.style.whiteSpace = "pre-wrap";
      card.appendChild(body);
    }

    if (item.file_url && isSafeUrl(item.file_url)) {
      card.appendChild(
        makeLink(item.file_url, "Open / Download PDF", "btn btn-gold")
      );
    }

    list.appendChild(card);
  });
}


// ============================================
// ANNOUNCEMENTS
// ============================================

async function loadAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;

  showLoading(list, "Loading announcements...");

  const { data, error } = await window.supabaseClient
    .from("announcements")
    .select("title, content, created_at")
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

  data.forEach(item => {
    const card = makeElement("article", "announcement-card");
    card.appendChild(makeElement("h3", "", item.title || "Announcement"));
    card.appendChild(makeElement("p", "", item.content || ""));

    if (item.created_at) {
      card.appendChild(makeElement(
        "div",
        "announcement-date",
        new Date(item.created_at).toLocaleDateString()
      ));
    }

    list.appendChild(card);
  });
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
    details.appendChild(makeElement("summary", "", "Read Article"));
    const content = makeElement("p", "content-text", blog.content || "");
    content.style.whiteSpace = "pre-wrap";
    details.appendChild(content);
    card.appendChild(details);

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

    const content = makeElement("p", "content-text", page.content || "");
    content.style.whiteSpace = "pre-wrap";
    article.appendChild(content);

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
