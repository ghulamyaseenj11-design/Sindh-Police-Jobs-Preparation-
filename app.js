
document.addEventListener("DOMContentLoaded", () => {
  injectAnimations();
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
