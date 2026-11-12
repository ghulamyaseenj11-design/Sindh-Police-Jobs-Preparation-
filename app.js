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
});

async function loadAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;

  if (!window.supabaseClient) {
    list.innerHTML = '<p class="muted">Announcements will appear here after the website database is connected.</p>';
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("announcements")
    .select("title, content, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Announcement loading error:", error);
    list.innerHTML = '<p class="muted">Announcements are temporarily unavailable.</p>';
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<p class="muted">No announcements have been published yet.</p>';
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
