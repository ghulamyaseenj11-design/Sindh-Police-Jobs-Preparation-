JavaScript

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
  setupStudyMaterials();
});


// =====================================
// STUDY NOTES SECTION
// =====================================

function setupStudyMaterials() {
  const section = document.getElementById("materials");

  if (!section) return;

  const container = section.querySelector(".container");

  if (!container) return;

  const oldEmptyState = container.querySelector(".empty-state");

  if (oldEmptyState) {
    oldEmptyState.remove();
  }

  let list = document.getElementById("publicStudyMaterials");

  if (!list) {
    list = document.createElement("div");
    list.id = "publicStudyMaterials";
    list.className = "study-materials-grid";
    container.appendChild(list);
  }

  loadStudyMaterials();
}


// =====================================
// LOAD PUBLISHED NOTES
// =====================================

async function loadStudyMaterials() {
  const list = document.getElementById("publicStudyMaterials");

  if (!list) return;

  if (!window.supabaseClient) {
    list.textContent = "Database connection unavailable.";
    return;
  }

  list.textContent = "Loading study materials...";

  const { data, error } = await window.supabaseClient
    .from("study_materials")
    .select("id, title, category, description, body, file_url, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Study Notes Error:", error);

    list.textContent =
      "Could not load study notes: " + error.message;

    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "No study notes have been published yet.";
    return;
  }

  list.innerHTML = "";

  data.forEach(item => {
    const card = document.createElement("article");
    card.className = "info-card";
    card.style.marginBottom = "20px";

    const title = document.createElement("h3");
    title.textContent = item.title || "Study Notes";

    const category = document.createElement("p");
    category.className = "muted";
    category.textContent = "Category: " + (item.category || "General");

    const description = document.createElement("p");
    description.textContent = item.description || "";

    card.append(title, category, description);

    if (item.body) {
      const content = document.createElement("p");
      content.textContent = item.body;
      content.style.whiteSpace = "pre-wrap";
      card.appendChild(content);
    }

    if (item.file_url) {
      const pdfButton = document.createElement("a");

      pdfButton.href = item.file_url;
      pdfButton.target = "_blank";
      pdfButton.rel = "noopener noreferrer";
      pdfButton.className = "btn btn-gold";
      pdfButton.textContent = "Open / Download PDF";

      card.appendChild(pdfButton);
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
    list.textContent = "Announcements are unavailable.";
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("announcements")
    .select("title, content, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Announcement loading error:", error);
    list.textContent = "Announcements are temporarily unavailable.";
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "No announcements have been published yet.";
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
