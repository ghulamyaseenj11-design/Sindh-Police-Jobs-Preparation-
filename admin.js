document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const logoutButton = document.getElementById("logoutButton");
  const announcementForm = document.getElementById("announcementForm");

  if (!window.supabaseClient) {
    showMessage("loginMessage", "Database is not connected. Please configure config.js.", true);
    return;
  }

  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  announcementForm.addEventListener("submit", publishAnnouncement);

  checkExistingSession();
});

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.className = isError
    ? "form-message error"
    : "form-message success";
}

async function checkExistingSession() {
  const { data } = await window.supabaseClient.auth.getSession();

  if (data.session) {
    await verifyAdmin(data.session.user);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showMessage("loginMessage", "Signing in...");

  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("loginMessage", error.message, true);
    return;
  }

  await verifyAdmin(data.user);
}

async function verifyAdmin(user) {
  // The database function public.is_admin() must already exist.
  const { data, error } = await window.supabaseClient.rpc("is_admin");

  if (error || data !== true) {
    await window.supabaseClient.auth.signOut();
    showMessage("loginMessage", "Access denied. This account is not an authorized admin.", true);
    return;
  }

  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("dashboardSection").classList.remove("hidden");

  loadAdminAnnouncements();
}

async function handleLogout() {
  await window.supabaseClient.auth.signOut();
  location.reload();
}

async function publishAnnouncement(event) {
  event.preventDefault();

  const title = document.getElementById("announcementTitle").value.trim();
  const content = document.getElementById("announcementContent").value.trim();

  if (!title || !content) {
    showMessage("announcementMessage", "Please complete both fields.", true);
    return;
  }

  showMessage("announcementMessage", "Publishing...");

  const { error } = await window.supabaseClient
    .from("announcements")
    .insert([{
      title,
      content,
      is_active: true
    }]);

  if (error) {
    console.error(error);
    showMessage("announcementMessage", "Could not publish. Check your database columns and admin permissions.", true);
    return;
  }

  document.getElementById("announcementForm").reset();
  showMessage("announcementMessage", "Announcement published successfully!");
  loadAdminAnnouncements();
}

async function loadAdminAnnouncements() {
  const list = document.getElementById("adminAnnouncementList");

  const { data, error } = await window.supabaseClient
    .from("announcements")
    .select("title, content, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    list.textContent = "Could not load announcements. Check admin read permissions.";
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "No announcements found.";
    return;
  }

  list.innerHTML = "";

  data.forEach(item => {
    const wrapper = document.createElement("div");
    wrapper.className = "admin-announcement";

    const heading = document.createElement("h3");
    heading.textContent = item.title || "Announcement";

    const content = document.createElement("p");
    content.textContent = item.content || "";

    const date = document.createElement("small");
    date.className = "muted";
    date.textContent = item.created_at
      ? new Date(item.created_at).toLocaleString()
      : "";

    wrapper.append(heading, content, date);
    list.appendChild(wrapper);
  });
  }
