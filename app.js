
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const year = document.getElementById("year");

  if (year) year.textContent = new Date().getFullYear();

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      mainNav.classList.toggle("open");
    });

    mainNav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => mainNav.classList.remove("open"));
    });
  }

  loadAnnouncements();
  createStudyNotesSection();
  loadStudyMaterials();
});


// =====================================
// PUBLIC STUDY NOTES SECTION
// =====================================

function createStudyNotesSection() {
  if (document.getElementById("studyMaterialsSection")) return;

  const main = document.querySelector("main");
  if (!main) return;

  const section = document.createElement("section");
  section.id = "studyMaterialsSection";
  section.className = "container";
  section.style.padding = "40px 0";

  const heading = document.createElement("h2");
  heading.textContent = "Study Notes & PDF Materials";

  const description = document.createElement("p");
  description.className = "muted";
  description.textContent =
    "Explore published study notes and download preparation materials.";

  const list = document.createElement("div");
  list.id = "publicStudyMaterials";

  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading study materials...";

  list.appendChild(loading);
  section.append(heading, description, list);

  main.appendChild(section);
}


// =====================================
// LOAD PUBLISHED STUDY MATERIALS
// =====================================

async function loadStudyMaterials() {
  const list = document.getElementById("publicStudyMaterials");
  if (!list) return;

  if (!window.supabaseClient) {
    list.textContent = "Study materials are temporarily unavailable.";
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("study_materials")
    .select("id, title, category, description, body, file_url, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Study materials loading error:", error);
    list.textContent = "Study materials are temporarily unavailable.";
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "No study notes have been published yet.";
    return;
  }

  list.innerHTML = "";

  data.forEach(item => {
    const card = document.createElement("article");
    card.className = "admin-announcement";
    card.style.marginBottom = "18px";
    card.style.padding = "20px";

    const heading = document.createElement("h3");
    heading.textContent = item.title || "Study Notes";

    const category = document.createElement("p");
    category.className = "muted";
    category.textContent = "Category: " + (item.category || "General");

    const description = document.createElement("p");
    description.textContent = item.description || "";

    card.append(heading, category, description);

    if (item.body) {
      const body = document.createElement("p");
      body.textContent = item.body;
      body.style.whiteSpace = "pre-wrap";
      card.appendChild(body);
    }

    if (item.file_url) {
      const pdfLink = document.createElement("a");
      pdfLink.href = item.file_url;
      pdfLink.target = "_blank";
      pdfLink.rel = "noopener noreferrer";
      pdfLink.textContent = "Open / Download PDF";
      pdfLink.className = "btn btn-gold";
      pdfLink.style.display = "inline-block";
      pdfLink.style.marginTop = "12px";

      card.appendChild(pdfLink);
    }

    list.appendChild(card);
  });
}


// =====================================
// ANNOUNCEMENTS - EXISTING CODE
// =====================================

async function loadAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;

  if (!window.supabaseClient) {
    list.innerHTML =
      '<p class="muted">Announcements will appear here after the website database is connected.</p>';
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("announcements")
    .select("title, content, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Announcement loading error:", error);
    list.innerHTML =
      '<p class="muted">Announcements are temporarily unavailable.</p>';
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      '<p class="muted">No announcements have been published yet.</p>';
    return;
  }

  list.innerHTML = "";

  data.forEach(item => {
    const article = document.createElement("article");
    article.className = "announcement-card";

    const heading = document.createElement("h3");
    heading.textContent = item.title || "Announcement";

    const content = document.createElement("p");
    content.textContent = item.content || "";

    const date = document.createElement("div");
    date.className = "announcement-date";
    date.textContent = item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : "";

    article.append(heading, content, date);
    list.appendChild(article);
  });
}
