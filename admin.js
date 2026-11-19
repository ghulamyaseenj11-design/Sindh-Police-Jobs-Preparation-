
document.addEventListener("DOMContentLoaded", () => {
  const db = window.supabaseClient;

  if (!db) {
    showMessage("loginMessage", "Database connection unavailable. Check config.js.", true);
    return;
  }

  const formIds = [
    "loginForm",
    "studyNotesForm",
    "blogForm",
    "pageForm",
    "galleryForm",
    "announcementForm",
    "navigationForm",
    "settingsForm"
  ];

  formIds.forEach(id => {
    const form = document.getElementById(id);
    if (form) form.addEventListener("submit", event => event.preventDefault());
  });

  document.getElementById("loginForm")
    ?.addEventListener("submit", handleLogin);

  document.getElementById("logoutButton")
    ?.addEventListener("click", handleLogout);

  document.getElementById("studyNotesForm")
    ?.addEventListener("submit", saveStudyNote);

  document.getElementById("blogForm")
    ?.addEventListener("submit", saveBlog);

  document.getElementById("pageForm")
    ?.addEventListener("submit", savePage);

  document.getElementById("galleryForm")
    ?.addEventListener("submit", saveGallery);

  document.getElementById("announcementForm")
    ?.addEventListener("submit", saveAnnouncement);

  document.getElementById("navigationForm")
    ?.addEventListener("submit", saveNavigation);

  document.getElementById("settingsForm")
    ?.addEventListener("submit", saveSettings);

  document.getElementById("cancelNoteEdit")
    ?.addEventListener("click", () => resetForm("studyNotesForm"));

  document.getElementById("cancelBlogEdit")
    ?.addEventListener("click", () => resetForm("blogForm"));

  document.getElementById("cancelNavigationEdit")
    ?.addEventListener("click", () => resetForm("navigationForm"));

  checkExistingSession();
});

const $ = id => document.getElementById(id);
const db = () => window.supabaseClient;

function value(id) {
  return $(id)?.value?.trim() || "";
}

function showMessage(id, message, isError = false) {
  const el = $(id);
  if (!el) return;

  el.textContent = message;
  el.className = isError
    ? "form-message error"
    : "form-message success";
}

function resetForm(id) {
  $(id)?.reset();

  const hiddenId = {
    studyNotesForm: "studyNoteId",
    blogForm: "blogId",
    navigationForm: "navigationId"
  }[id];

  if (hiddenId && $(hiddenId)) $(hiddenId).value = "";
}

function setButtonLoading(formId, loading, text = "Saving...") {
  const button = $(formId)?.querySelector('button[type="submit"]');
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || "Save";
  }
}

function reportError(messageId, error) {
  console.error(error);
  showMessage(
    messageId,
    error?.message || "Something went wrong. Please try again.",
    true
  );
}

function showLogin() {
  $("loginSection")?.classList.remove("hidden");
  $("dashboardSection")?.classList.add("hidden");
}

function showDashboard() {
  $("loginSection")?.classList.add("hidden");
  $("dashboardSection")?.classList.remove("hidden");
}

async function checkExistingSession() {
  try {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;

    if (data.session) {
      await verifyAdmin();
    } else {
      // No login on this page any more: the panel opens only after logging in.
      window.location.replace("auth.html");
    }
  } catch (error) {
    console.error(error);
    window.location.replace("auth.html");
  }
}

// LOGIN

async function handleLogin(event) {
  event.preventDefault();

  const email = value("email");
  const password = $("password")?.value || "";

  if (!email || !password) {
    showMessage("loginMessage", "Enter your email and password.", true);
    return;
  }

  showMessage("loginMessage", "Signing in...", false);

  const button = $("loginForm").querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    const { error } = await db().auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    await verifyAdmin();
  } catch (error) {
    reportError("loginMessage", error);
  } finally {
    if (button) button.disabled = false;
  }
}

async function verifyAdmin() {
  const { data: sessionData, error: sessionError } =
    await db().auth.getSession();

  if (sessionError || !sessionData.session) {
    window.location.replace("auth.html");
    return false;
  }

  const { data, error } = await db().rpc("is_admin");

  if (error) {
    await db().auth.signOut();
    window.location.replace("auth.html");
    return false;
  }

  const allowed =
    data === true ||
    data?.is_admin === true ||
    (Array.isArray(data) && data.some(row => row?.is_admin === true));

  if (!allowed) {
    await db().auth.signOut();
    window.location.replace("auth.html");
    return false;
  }

  showDashboard();
  await loadAllData();
  return true;
}

async function handleLogout() {
  const { error } = await db().auth.signOut();

  if (error) {
    reportError("loginMessage", error);
    return;
  }

  location.reload();
}

// STORAGE UPLOAD

async function uploadFile(file, folder) {
  if (!file) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await db()
    .storage
    .from("site-media")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = db()
    .storage
    .from("site-media")
    .getPublicUrl(path);

  return data.publicUrl;
}

// STUDY NOTES

async function saveStudyNote(event) {
  event.preventDefault();

  const id = value("studyNoteId");
  const title = value("noteTitle");
  const category = value("noteCategory");

  if (!title || !category) {
    showMessage("studyNoteMessage", "Title and category are required.", true);
    return;
  }

  setButtonLoading("studyNotesForm", true, "Saving Notes...");
  showMessage("studyNoteMessage", "Saving...", false);

  try {
    const payload = {
      title,
      category,
      description: value("noteDescription"),
      body: value("noteBody"),
      published: value("notePublished") === "true"
    };

    const file = $("notePdf").files[0];

    if (file) {
      if (file.type !== "application/pdf") {
        throw new Error("Please select a PDF file.");
      }
      payload.file_url = await uploadFile(file, "study-notes");
    }

    const query = id
      ? db().from("study_materials").update(payload).eq("id", id)
      : db().from("study_materials").insert([payload]);

    const { error } = await query;
    if (error) throw error;

    resetForm("studyNotesForm");
    showMessage("studyNoteMessage", "Study notes saved successfully!");
    await loadStudyNotes();
  } catch (error) {
    reportError("studyNoteMessage", error);
  } finally {
    setButtonLoading("studyNotesForm", false);
  }
}

async function loadStudyNotes() {
  const list = $("adminStudyNotesList");

  try {
    const { data, error } = await db()
      .from("study_materials")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderList(list, data, item => [
      item.title,
      item.category,
      item.published ? "Published" : "Draft"
    ], item => {
      addButton(item.title, "Edit", () => {
        $("studyNoteId").value = item.id;
        $("noteTitle").value = item.title || "";
        $("noteCategory").value = item.category || "";
        $("noteDescription").value = item.description || "";
        $("noteBody").value = item.body || "";
        $("notePublished").value = String(!!item.published);
        $("studyNotesManager").scrollIntoView({ behavior: "smooth" });
      }, list);
    }, item => deleteRecord("study_materials", item.id, "studyNoteMessage", loadStudyNotes));
  } catch (error) {
    reportError("studyNoteMessage", error);
  }
}

// BLOGS

async function saveBlog(event) {
  event.preventDefault();

  const id = value("blogId");

  if (!value("blogTitle") || !value("blogSlug") || !value("blogContent")) {
    showMessage("blogMessage", "Title, slug and content are required.", true);
    return;
  }

  setButtonLoading("blogForm", true, "Saving Blog...");
  showMessage("blogMessage", "Saving blog...", false);

  try {
    const payload = {
      title: value("blogTitle"),
      slug: value("blogSlug"),
      excerpt: value("blogExcerpt"),
      content: value("blogContent"),
      published: value("blogPublished") === "true",
      updated_at: new Date().toISOString()
    };

    const file = $("blogImage").files[0];

    if (file) {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please select a valid image.");
      }
      payload.image_url = await uploadFile(file, "blogs");
    }

    const query = id
      ? db().from("site_blogs").update(payload).eq("id", id)
      : db().from("site_blogs").insert([payload]);

    const { error } = await query;
    if (error) throw error;

    resetForm("blogForm");
    showMessage("blogMessage", "Blog saved successfully!");
    await loadBlogs();
  } catch (error) {
    reportError("blogMessage", error);
  } finally {
    setButtonLoading("blogForm", false);
  }
}

async function loadBlogs() {
  try {
    const { data, error } = await db()
      .from("site_blogs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderList($("adminBlogsList"), data, item => [
      item.title,
      item.slug,
      item.published ? "Published" : "Draft"
    ], item => {
      addButton(item.title, "Edit", () => {
        $("blogId").value = item.id;
        $("blogTitle").value = item.title || "";
        $("blogSlug").value = item.slug || "";
        $("blogExcerpt").value = item.excerpt || "";
        $("blogContent").value = item.content || "";
        $("blogPublished").value = String(!!item.published);
        $("blogsManager").scrollIntoView({ behavior: "smooth" });
      }, $("adminBlogsList"));
    }, item => deleteRecord("site_blogs", item.id, "blogMessage", loadBlogs));
  } catch (error) {
    reportError("blogMessage", error);
  }
}

// PAGES

async function savePage(event) {
  event.preventDefault();

  const id = value("pageId");

  if (!value("pageTitle") || !value("pageSlug") || !value("pageContent")) {
    showMessage("pageMessage", "Complete all required fields.", true);
    return;
  }

  setButtonLoading("pageForm", true);

  try {
    const payload = {
      title: value("pageTitle"),
      slug: value("pageSlug"),
      content: value("pageContent"),
      published: value("pagePublished") === "true",
      updated_at: new Date().toISOString()
    };

    const query = id
      ? db().from("site_pages").update(payload).eq("id", id)
      : db().from("site_pages").insert([payload]);

    const { error } = await query;
    if (error) throw error;

    resetForm("pageForm");
    showMessage("pageMessage", "Page saved successfully!");
    await loadPages();
  } catch (error) {
    reportError("pageMessage", error);
  } finally {
    setButtonLoading("pageForm", false);
  }
}

async function loadPages() {
  try {
    const { data, error } = await db()
      .from("site_pages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderList($("adminPagesList"), data, item => [
      item.title,
      item.slug,
      item.published ? "Published" : "Draft"
    ], item => {
      addButton(item.title, "Edit", () => {
        $("pageId").value = item.id;
        $("pageTitle").value = item.title || "";
        $("pageSlug").value = item.slug || "";
        $("pageContent").value = item.content || "";
        $("pagePublished").value = String(!!item.published);
        $("pagesManager").scrollIntoView({ behavior: "smooth" });
      }, $("adminPagesList"));
    }, item => deleteRecord("site_pages", item.id, "pageMessage", loadPages));
  } catch (error) {
    reportError("pageMessage", error);
  }
}

// GALLERY

async function saveGallery(event) {
  event.preventDefault();

  const file = $("galleryImage").files[0];

  if (!file) {
    showMessage("galleryMessage", "Please select an image.", true);
    return;
  }

  setButtonLoading("galleryForm", true, "Uploading...");

  try {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please select a valid image.");
    }

    const imageUrl = await uploadFile(file, "gallery");

    const { error } = await db()
      .from("site_gallery")
      .insert([{
        title: value("galleryTitle"),
        description: value("galleryDescription"),
        image_url: imageUrl,
        published: true
      }]);

    if (error) throw error;

    resetForm("galleryForm");
    showMessage("galleryMessage", "Image uploaded successfully!");
    await loadGallery();
  } catch (error) {
    reportError("galleryMessage", error);
  } finally {
    setButtonLoading("galleryForm", false);
  }
}

async function loadGallery() {
  try {
    const { data, error } = await db()
      .from("site_gallery")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const list = $("adminGalleryList");
    list.replaceChildren();

    if (!data?.length) {
      list.textContent = "No gallery images found.";
      return;
    }

    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "admin-announcement";

      const img = document.createElement("img");
      img.src = item.image_url;
      img.alt = item.title || "Gallery image";
      img.style.maxWidth = "180px";
      img.style.height = "auto";

      const title = document.createElement("h3");
      title.textContent = item.title || "Gallery image";

      const desc = document.createElement("p");
      desc.textContent = item.description || "";

      card.append(img, title, desc);

      const button = makeButton("Delete", () =>
        deleteRecord("site_gallery", item.id, "galleryMessage", loadGallery)
      );

      card.appendChild(button);
      list.appendChild(card);
    });
  } catch (error) {
    reportError("galleryMessage", error);
  }
}

// ANNOUNCEMENTS

function stripAnnouncementLink(content) {
  var text = String(content || "");
  var m = text.match(/\[LINK\]([\s\S]*?)\[\/LINK\]/);
  if (!m) return { text: text, link: "" };
  return { text: text.replace(m[0], "").trim(), link: (m[1].split("|")[0] || "").trim() };
}

async function saveAnnouncement(event) {
  event.preventDefault();

  const title = value("announcementTitle");
  const content = value("announcementContent");
  const link = value("announcementLink");
  const linkText = value("announcementButtonText");

  if (!title || !content) {
    showMessage("announcementMessage", "Enter title and details.", true);
    return;
  }

  // A linked announcement keeps its link at the end of the details as
  // [LINK]url|Button text[/LINK]; the homepage popup and list read it back.
  var finalContent = content;
  if (link) {
    finalContent = content + "\n\n[LINK]" + link + "|" + (linkText || "Click here") + "[/LINK]";
  }

  setButtonLoading("announcementForm", true, "Publishing...");

  try {
    const { error } = await db()
      .from("announcements")
      .insert([{ title, content: finalContent, is_active: true }]);

    if (error) throw error;

    resetForm("announcementForm");
    showMessage("announcementMessage", "Announcement published successfully!");
    await loadAnnouncements();
  } catch (error) {
    reportError("announcementMessage", error);
  } finally {
    setButtonLoading("announcementForm", false);
  }
}

async function loadAnnouncements() {
  try {
    const { data, error } = await db()
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderList($("adminAnnouncementList"), data, item => {
      var parsed = stripAnnouncementLink(item.content);
      var lines = [item.title, parsed.text, item.is_active ? "Active" : "Inactive"];
      if (parsed.link) lines.push("Link: " + parsed.link);
      return lines;
    }, null, item =>
      deleteRecord("announcements", item.id, "announcementMessage", loadAnnouncements)
    );
  } catch (error) {
    reportError("announcementMessage", error);
  }
}

// NAVIGATION

async function saveNavigation(event) {
  event.preventDefault();

  const id = value("navigationId");

  if (!value("navigationTitle") || !value("navigationUrl")) {
    showMessage("navigationMessage", "Menu name and URL are required.", true);
    return;
  }

  setButtonLoading("navigationForm", true);

  try {
    const payload = {
      title: value("navigationTitle"),
      url: value("navigationUrl"),
      sort_order: Number(value("navigationOrder")) || 0,
      is_active: value("navigationActive") === "true"
    };

    const query = id
      ? db().from("site_navigation").update(payload).eq("id", id)
      : db().from("site_navigation").insert([payload]);

    const { error } = await query;
    if (error) throw error;

    resetForm("navigationForm");
    showMessage("navigationMessage", "Navigation link saved successfully!");
    await loadNavigation();
  } catch (error) {
    reportError("navigationMessage", error);
  } finally {
    setButtonLoading("navigationForm", false);
  }
}

async function loadNavigation() {
  try {
    const { data, error } = await db()
      .from("site_navigation")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    renderList($("adminNavigationList"), data, item => [
      item.title,
      item.url,
      item.is_active ? "Visible" : "Hidden",
      `Order: ${item.sort_order}`
    ], item => {
      addButton(item.title, "Edit", () => {
        $("navigationId").value = item.id;
        $("navigationTitle").value = item.title || "";
        $("navigationUrl").value = item.url || "";
        $("navigationOrder").value = item.sort_order ?? 0;
        $("navigationActive").value = String(!!item.is_active);
        $("navigationManager").scrollIntoView({ behavior: "smooth" });
      }, $("adminNavigationList"));
    }, item => deleteRecord("site_navigation", item.id, "navigationMessage", loadNavigation));
  } catch (error) {
    reportError("navigationMessage", error);
  }
}

// WEBSITE SETTINGS

async function saveSettings(event) {
  event.preventDefault();

  setButtonLoading("settingsForm", true, "Saving Settings...");

  try {
    const settings = {
      site_name: value("settingSiteName"),
      logo_url: value("settingLogo"),
      contact: value("settingContact"),
      email: value("settingEmail"),
      whatsapp: value("settingWhatsapp"),
      about: value("settingAbout")
    };

    const rows = Object.entries(settings).map(([key, val]) => ({
      setting_key: key,
      setting_value: val
    }));

    const { error } = await db()
      .from("site_settings")
      .upsert(rows, { onConflict: "setting_key" });

    if (error) throw error;

    showMessage("settingsMessage", "Website settings saved successfully!");
  } catch (error) {
    reportError("settingsMessage", error);
  } finally {
    setButtonLoading("settingsForm", false);
  }
}

async function loadSettings() {
  try {
    const { data, error } = await db()
      .from("site_settings")
      .select("setting_key, setting_value");

    if (error) throw error;

    const fields = {
      site_name: "settingSiteName",
      logo_url: "settingLogo",
      contact: "settingContact",
      email: "settingEmail",
      whatsapp: "settingWhatsapp",
      about: "settingAbout"
    };

    (data || []).forEach(item => {
      const id = fields[item.setting_key];
      if (id && $(id)) $(id).value = item.setting_value || "";
    });
  } catch (error) {
    reportError("settingsMessage", error);
  }
}

// COMMON LIST AND DELETE HELPERS

function makeButton(label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-dark";
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function addButton(title, label, callback, container) {
  const button = makeButton(label, callback);
  button.setAttribute("aria-label", `${label} ${title}`);
  container.appendChild(button);
}

function renderList(container, data, getLines, editCallback, deleteCallback) {
  if (!container) return;

  container.replaceChildren();

  if (!data?.length) {
    container.textContent = "No records found.";
    return;
  }

  data.forEach(item => {
    const card = document.createElement("div");
    card.className = "admin-announcement";

    getLines(item).forEach(line => {
      const p = document.createElement("p");
      p.textContent = line ?? "";
      card.appendChild(p);
    });

    if (editCallback) {
      const editHolder = document.createElement("div");
      editCallback(item, editHolder);
      card.appendChild(editHolder);
    }

    if (deleteCallback) {
      card.appendChild(makeButton("Delete", () => deleteCallback(item)));
    }

    container.appendChild(card);
  });
}

async function deleteRecord(table, id, messageId, reloadFunction) {
  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    const { error } = await db()
      .from(table)
      .delete()
      .eq("id", id);

    if (error) throw error;

    showMessage(messageId, "Deleted successfully!");
    await reloadFunction();
  } catch (error) {
    reportError(messageId, error);
  }
}

// LOAD ALL DASHBOARD DATA

async function loadAllData() {
  await Promise.all([
    loadStudyNotes(),
    loadBlogs(),
    loadPages(),
    loadGallery(),
    loadAnnouncements(),
    loadNavigation(),
    loadSettings(),
    loadDashboardCounts()
  ]);
}

async function loadDashboardCounts() {
  const stats = [
    ['mock_tests', 'statMockTests'],
    ['study_materials', 'statNotes'],
    ['site_blogs', 'statBlogs'],
    ['announcements', 'statAnnouncements'],
    ['site_pages', 'statPages'],
    ['site_gallery', 'statGallery']
  ];
  await Promise.all(stats.map(async ([table, id]) => {
    try {
      const { count, error } = await db().from(table).select('id', { count: 'exact', head: true });
      if (error) throw error;
      const el = document.getElementById(id);
      if (el) el.textContent = count ?? '–';
    } catch (e) { console.error(e); }
  }));
}

// ---- LOGIN ACCOUNTS + VIEWS ----
const ADMIN_SETUP_SQL = `-- Study with GYJ: admin Users + Views setup. Run ONCE in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- After it runs, reopen the admin panel: Users and Views will work. No website code change needed.

-- 1) Views table: one row per page view and per test / note open
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  section text,
  item text,
  created_at timestamptz not null default now()
);
alter table public.page_views enable row level security;
drop policy if exists "Anyone can record a view" on public.page_views;
create policy "Anyone can record a view" on public.page_views for insert with check (true);
drop policy if exists "Admins can read views" on public.page_views;
create policy "Admins can read views" on public.page_views for select using (
  exists (select 1 from public.admin_users where user_id = auth.uid())
);

-- 2) List all login accounts (admin only)
create or replace function public.admin_list_users()
returns table (user_id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz, confirmed_at timestamptz, banned boolean, is_admin boolean)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'name', ''),
    u.created_at, u.last_sign_in_at, u.email_confirmed_at,
    (u.banned_until is not null and u.banned_until > now()),
    exists (select 1 from public.admin_users a where a.user_id = u.id)
  from auth.users u
  where exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  order by u.created_at desc;
$$;

-- 3) Edit a login account: change name, ban or unban (admin only, never the admin account)
create or replace function public.admin_update_user(p_user_id uuid, p_name text, p_ban boolean)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_admin boolean;
begin
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid()) into v_admin;
  if not v_admin then return false; end if;
  if exists (select 1 from public.admin_users a where a.user_id = p_user_id) then return false; end if;
  update auth.users set
    raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{name}', to_jsonb(p_name)),
    banned_until = case when p_ban then now() + interval '100 years' else null end
  where id = p_user_id;
  return found;
end;
$$;

-- 4) Delete a login account (admin only, never the admin account)
create or replace function public.admin_delete_user(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_admin boolean;
begin
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid()) into v_admin;
  if not v_admin then return false; end if;
  if exists (select 1 from public.admin_users a where a.user_id = p_user_id) then return false; end if;
  delete from auth.users where id = p_user_id;
  return found;
end;
$$;
`;

function showSetupNotices() {
  ["usersSetupNotice", "viewsSetupNotice"].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove("hidden");
  });
  ["usersSetupSql", "viewsSetupSql"].forEach(id => {
    const el = $(id);
    if (el && !el.value) el.value = ADMIN_SETUP_SQL;
  });
}

function copySetupSql(id) {
  const el = $(id);
  if (!el) return;
  const msgId = id === "usersSetupSql" ? "usersMessage" : "viewsMessage";
  const done = () => showMessage(msgId, "SQL copied.", false);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(el.value).then(done, () => { el.select(); document.execCommand("copy"); done(); });
  } else {
    el.select();
    document.execCommand("copy");
    done();
  }
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) { return "—"; }
}

function escHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadUsers() {
  const list = $("usersList");
  if (list) list.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    const { data, error } = await db().rpc("admin_list_users");
    if (error) throw error;
    if (!data || !data.length) {
      if (list) list.innerHTML = "<p class='muted'>No accounts yet.</p>";
      return;
    }
    renderUsers(data);
  } catch (error) {
    console.error(error);
    showSetupNotices();
    showMessage("usersMessage", "Accounts list needs the one-time setup below.", true);
  }
}

function renderUsers(users) {
  const list = $("usersList");
  if (!list) return;
  let html = "<table class='users-table'><thead><tr><th>Account</th><th>Name</th><th>Last sign-in</th><th>Status</th><th>Actions</th></tr></thead><tbody>";
  users.forEach(u => {
    const badge = u.is_admin
      ? "<span class='badge badge-admin'>Admin</span>"
      : u.banned
        ? "<span class='badge badge-banned'>Banned</span>"
        : "<span class='badge badge-active'>Active</span>";
    const actions = u.is_admin
      ? "<span class='muted'>—</span>"
      : "<span class='user-actions'>" +
        "<button type='button' class='btn btn-outline-dark' data-action='edit' data-id='" + u.user_id + "'>Edit</button>" +
        "<button type='button' class='btn btn-outline-dark' data-action='ban' data-id='" + u.user_id + "' data-name='" + escHtml(u.name) + "' data-banned='" + (u.banned ? "1" : "0") + "'>" + (u.banned ? "Unban" : "Ban") + "</button>" +
        "<button type='button' class='btn btn-outline-dark' data-action='delete' data-id='" + u.user_id + "' data-email='" + escHtml(u.email) + "'>Delete</button>" +
        "</span>";
    html += "<tr data-id='" + u.user_id + "' data-banned='" + (u.banned ? "1" : "0") + "'><td><strong>" + escHtml(u.email) + "</strong><br><small class='muted'>Joined " + fmtDate(u.created_at) + "</small></td>" +
      "<td class='user-name-cell'>" + escHtml(u.name || "—") + "</td>" +
      "<td>" + fmtDate(u.last_sign_in_at) + "</td><td>" + badge + "</td><td>" + actions + "</td></tr>";
  });
  html += "</tbody></table>";
  list.innerHTML = html;
}

async function onUsersListClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = btn.closest("tr");
  if (!row) return;
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  if (action === "edit") {
    const cell = row.querySelector(".user-name-cell");
    const current = cell.textContent === "—" ? "" : cell.textContent;
    cell.innerHTML = "<input class='user-name-input' value='" + escHtml(current) + "'>";
    const actCell = row.querySelector(".user-actions");
    actCell.innerHTML = "<button type='button' class='btn btn-gold' data-action='save-name' data-id='" + id + "'>Save</button>" +
      "<button type='button' class='btn btn-outline-dark' data-action='cancel-edit'>Cancel</button>";
    const input = cell.querySelector("input");
    if (input) input.focus();
    return;
  }
  if (action === "cancel-edit") { loadUsers(); return; }
  if (action === "save-name") {
    const input = row.querySelector(".user-name-input");
    const name = input ? input.value.trim() : "";
    const banned = row.getAttribute("data-banned") === "1";
    const { error } = await db().rpc("admin_update_user", { p_user_id: id, p_name: name, p_ban: banned });
    if (error) { showMessage("usersMessage", error.message, true); return; }
    showMessage("usersMessage", "Name updated.", false);
    loadUsers();
    return;
  }
  if (action === "ban") {
    const name = btn.getAttribute("data-name") || "";
    const banned = btn.getAttribute("data-banned") === "1";
    const { error } = await db().rpc("admin_update_user", { p_user_id: id, p_name: name, p_ban: !banned });
    if (error) { showMessage("usersMessage", error.message, true); return; }
    showMessage("usersMessage", banned ? "Account unbanned." : "Account banned.", false);
    loadUsers();
    return;
  }
  if (action === "delete") {
    const email = btn.getAttribute("data-email") || "this account";
    if (!confirm("Delete " + email + "? This cannot be undone.")) return;
    const { data, error } = await db().rpc("admin_delete_user", { p_user_id: id });
    if (error) { showMessage("usersMessage", error.message, true); return; }
    if (data !== true) { showMessage("usersMessage", "Could not delete this account.", true); return; }
    showMessage("usersMessage", "Account deleted.", false);
    loadUsers();
    return;
  }
}

const PAGE_LABELS = {
  index: "Homepage", "mock-tests": "Mock Tests", papers: "Papers", videos: "Videos",
  departments: "Departments", category: "Department Page", auth: "Login Page",
  profile: "Profile", about: "About", "privacy-policy": "Privacy Policy", terms: "Terms"
};

function countBy(rows, keyFn) {
  const map = {};
  rows.forEach(r => {
    const k = keyFn(r);
    if (!k) return;
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function renderTop(el, entries, emptyText) {
  if (!el) return;
  if (!entries.length) { el.innerHTML = "<p class='muted'>" + emptyText + "</p>"; return; }
  el.innerHTML = entries.slice(0, 8).map(([label, n]) =>
    "<div class='views-row'><span>" + escHtml(label) + "</span><b>" + n + "</b></div>"
  ).join("");
}

async function loadViews() {
  const content = $("viewsContent");
  try {
    const { data, error } = await db().from("page_views")
      .select("page,section,item,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    const rows = data || [];
    const now = Date.now();
    const day = 86400000;
    $("statViewsTotal").textContent = rows.length + (rows.length >= 5000 ? "+" : "");
    $("statViewsToday").textContent = rows.filter(r => now - new Date(r.created_at).getTime() < day).length;
    $("statViewsWeek").textContent = rows.filter(r => now - new Date(r.created_at).getTime() < 7 * day).length;
    renderTop($("viewsTopPages"), countBy(rows, r => PAGE_LABELS[r.page] || r.page), "No page views yet.");
    renderTop($("viewsTopSections"), countBy(rows, r => r.section), "No section views yet.");
    renderTop($("viewsTopItems"), countBy(rows, r => r.item), "No tests or notes opened yet.");
    const recent = $("viewsRecent");
    if (recent) {
      recent.innerHTML = rows.slice(0, 15).map(r =>
        "<div class='views-row'><span>" + escHtml(PAGE_LABELS[r.page] || r.page) +
        (r.section ? " · " + escHtml(r.section) : "") +
        (r.item ? " · " + escHtml(r.item) : "") +
        "</span><span class='muted'>" + fmtDate(r.created_at) + "</span></div>"
      ).join("") || "<p class='muted'>No views yet.</p>";
    }
    if (content) content.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    showSetupNotices();
    showMessage("viewsMessage", "Views need the one-time setup below.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector('[data-target="usersManager"]')?.addEventListener("click", loadUsers);
  document.querySelector('[data-target="viewsManager"]')?.addEventListener("click", loadViews);
  $("refreshUsersBtn")?.addEventListener("click", loadUsers);
  $("refreshViewsBtn")?.addEventListener("click", loadViews);
  $("copyUsersSqlBtn")?.addEventListener("click", () => copySetupSql("usersSetupSql"));
  $("copyViewsSqlBtn")?.addEventListener("click", () => copySetupSql("viewsSetupSql"));
  const ul = $("usersList");
  if (ul) ul.addEventListener("click", onUsersListClick);
});
