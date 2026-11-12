JavaScript

// ============================================
// ADMIN PANEL - CLEAN FIXED VERSION
// Matches admin.html and Supabase table names
// ============================================

const $ = id => document.getElementById(id);
const db = () => window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  if (!db()) {
    showMessage("loginMessage", "Database connection failed. Check config.js.", true);
    return;
  }

  bind("loginForm", "submit", login);
  bind("logoutButton", "click", logout);
  bind("studyNotesForm", "submit", saveNote);
  bind("cancelNoteEdit", "click", resetNote);
  bind("blogForm", "submit", saveBlog);
  bind("cancelBlogEdit", "click", resetBlog);
  bind("pageForm", "submit", savePage);
  bind("cancelPageEdit", "click", resetPage);
  bind("galleryForm", "submit", uploadGallery);
  bind("announcementForm", "submit", saveAnnouncement);
  bind("navigationForm", "submit", saveNavigation);
  bind("cancelNavigationEdit", "click", resetNavigation);
  bind("settingsForm", "submit", saveSettings);

  checkSession();
});

function bind(id, event, callback) {
  const el = $(id);
  if (el) el.addEventListener(event, callback);
}

function val(id) {
  return $(id)?.value?.trim() || "";
}

function showMessage(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.className = "form-message" +
    (text ? (error ? " error" : " success") : "");
}

function report(id, error) {
  console.error(error);
  showMessage(id, error?.message || "Something went wrong.", true);
}

function setBusy(id, busy, normalText) {
  const el = $(id);
  if (!el) return;
  el.disabled = busy;
  if (busy) {
    el.dataset.oldText = el.textContent;
    el.textContent = "Please wait...";
  } else {
    el.textContent = normalText || el.dataset.oldText || "Save";
  }
}

function slugify(text) {
  return String(text || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function status(item) {
  return item.published ? "Published" : "Draft";
}

function makeCard(title, details, buttons = []) {
  const card = document.createElement("div");
  card.className = "admin-announcement";

  const heading = document.createElement("h3");
  heading.textContent = title || "";

  const paragraph = document.createElement("p");
  paragraph.className = "muted";
  paragraph.textContent = details || "";

  card.append(heading, paragraph);

  if (buttons.length) {
    const actions = document.createElement("div");
    actions.className = "admin-actions";
    buttons.forEach(button => actions.appendChild(button));
    card.appendChild(actions);
  }

  return card;
}

function makeButton(label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-dark";
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function addLink(parent, url, label) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  parent.appendChild(a);
}

async function uploadFile(file, folder, types, maxMB) {
  if (!file) return null;

  if (!types.includes(file.type)) {
    throw new Error("This file type is not allowed.");
  }

  if (file.size > maxMB * 1024 * 1024) {
    throw new Error("File size must be " + maxMB + " MB or less.");
  }

  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = folder + "/" + Date.now() + "-" + filename;

  const { error } = await db().storage
    .from("site-media")
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = db().storage
    .from("site-media")
    .getPublicUrl(path);

  return data.publicUrl;
}

async function saveRow(table, id, record) {
  const query = id
    ? db().from(table).update(record).eq("id", id)
    : db().from(table).insert([record]);

  const { error } = await query;
  if (error) throw error;
}

async function getOldValue(table, id, column) {
  const { data, error } = await db()
    .from(table)
    .select(column)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data?.[column] || null;
}

async function deleteRow(table, id, question, messageId, reload) {
  if (!confirm(question)) return;

  const { error } = await db()
    .from(table)
    .delete()
    .eq("id", id);

  if (error) {
    report(messageId, error);
    return;
  }

  showMessage(messageId, "Deleted successfully.");
  await reload();
}

async function loadRows(table, listId, order, ascending, emptyText, render) {
  const list = $(listId);
  if (!list) return;

  list.textContent = "Loading...";

  const { data, error } = await db()
    .from(table)
    .select("*")
    .order(order, { ascending });

  if (error) {
    list.textContent = error.message;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = emptyText;
    return;
  }

  list.replaceChildren();
  data.forEach(item => list.appendChild(render(item)));
}

function fillForm(fields, item, buttonId, buttonText, sectionId) {
  Object.entries(fields).forEach(([id, key]) => {
    const el = $(id);
    if (el) el.value = item[key] == null ? "" : String(item[key]);
  });

  if (buttonId && $(buttonId)) {
    $(buttonId).textContent = buttonText;
  }

  $(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function resetForm(formId, hiddenId, buttonId, buttonText) {
  $(formId)?.reset();
  if ($(hiddenId)) $(hiddenId).value = "";
  if ($(buttonId)) $(buttonId).textContent = buttonText;
}

// ============================================
// LOGIN AND ADMIN ACCESS
// ============================================

async function checkSession() {
  try {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      await verifyAdmin();
    }
  } catch (error) {
    report("loginMessage", error);
  }
}

async function login(event) {
  event.preventDefault();

  const email = val("email");
  const password = $("password")?.value || "";

  if (!email || !password) {
    showMessage("loginMessage", "Enter email and password.", true);
    return;
  }

  const button = $("loginForm")?.querySelector(
    'button[type="submit"]'
  );

  if (button) {
    button.disabled = true;
    button.textContent = "Signing in...";
  }

  showMessage("loginMessage", "Checking login details...");

  try {
    const { error } = await db().auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    await verifyAdmin();

  } catch (error) {
    report("loginMessage", error);

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
}

async function verifyAdmin() {
  const { data, error } = await db().rpc("is_admin");

  if (error) throw error;

  if (data !== true) {
    await db().auth.signOut();
    showMessage(
      "loginMessage",
      "Access denied. This account is not an authorized admin.",
      true
    );
    return;
  }

  $("loginSection")?.classList.add("hidden");
  $("dashboardSection")?.classList.remove("hidden");

  await Promise.allSettled([
    loadNotes(),
    loadBlogs(),
    loadPages(),
    loadGallery(),
    loadAnnouncements(),
    loadNavigation(),
    loadSettings()
  ]);
}

async function logout() {
  await db().auth.signOut();
  location.reload();
}

// ============================================
// STUDY NOTES
// Table: study_materials
// ============================================

async function saveNote(event) {
  event.preventDefault();

  const id = val("studyNoteId");
  const file = $("notePdf")?.files?.[0];
  const title = val("noteTitle");
  const category = val("noteCategory");
  const body = val("noteBody");

  if (!title || !category || (!body && !file && !id)) {
    showMessage(
      "studyNoteMessage",
      "Enter title, category and notes content or PDF.",
      true
    );
    return;
  }

  setBusy("saveNoteButton", true);

  try {
    let file_url = id
      ? await getOldValue("study_materials", id, "file_url")
      : null;

    if (file) {
      file_url = await uploadFile(
        file,
        "study-notes",
        ["application/pdf"],
        10
      );
    }

    await saveRow("study_materials", id, {
      title,
      category,
      description: val("noteDescription") || null,
      body: body || null,
      file_url,
      published: val("notePublished") === "true"
    });

    resetNote();
    showMessage("studyNoteMessage", "Study notes saved successfully.");
    await loadNotes();

  } catch (error) {
    report("studyNoteMessage", error);

  } finally {
    setBusy("saveNoteButton", false, "Save Notes");
  }
}

function loadNotes() {
  return loadRows(
    "study_materials",
    "adminStudyNotesList",
    "created_at",
    false,
    "No study notes found.",
    note => {
      const card = makeCard(
        note.title,
        "Category: " + note.category + " | " + status(note),
        [
          makeButton("Edit", () => editNote(note)),
          makeButton("Delete", () =>
            deleteRow(
              "study_materials",
              note.id,
              "Delete these study notes?",
              "studyNoteMessage",
              loadNotes
            )
          )
        ]
      );

      if (note.description) {
        const p = document.createElement("p");
        p.textContent = note.description;
        card.appendChild(p);
      }

      addLink(card, note.file_url, "Open PDF");
      return card;
    }
  );
}

function editNote(note) {
  fillForm({
    studyNoteId: "id",
    noteTitle: "title",
    noteCategory: "category",
    noteDescription: "description",
    noteBody: "body",
    notePublished: "published"
  }, note, "saveNoteButton", "Update Notes", "studyNotesManager");

  if ($("notePdf")) $("notePdf").value = "";
}

function resetNote() {
  resetForm(
    "studyNotesForm",
    "studyNoteId",
    "saveNoteButton",
    "Save Notes"
  );
}

// ============================================
// BLOGS
// Table: site_blogs
// ============================================

async function saveBlog(event) {
  event.preventDefault();

  const id = val("blogId");
  const file = $("blogImage")?.files?.[0];
  const title = val("blogTitle");
  const slug = slugify(val("blogSlug") || title);
  const content = val("blogContent");

  if (!title || !slug || !content) {
    showMessage("blogMessage", "Complete all required blog fields.", true);
    return;
  }

  setBusy("saveBlogButton", true);

  try {
    let image_url = id
      ? await getOldValue("site_blogs", id, "image_url")
      : null;

    if (file) {
      image_url = await uploadFile(
        file,
        "blogs",
        ["image/jpeg", "image/png", "image/webp"],
        5
      );
    }

    await saveRow("site_blogs", id, {
      title,
      slug,
      excerpt: val("blogExcerpt") || null,
      content,
      image_url,
      published: val("blogPublished") === "true",
      updated_at: new Date().toISOString()
    });

    resetBlog();
    showMessage("blogMessage", "Blog saved successfully.");
    await loadBlogs();

  } catch (error) {
    report("blogMessage", error);

  } finally {
    setBusy("saveBlogButton", false, "Save Blog");
  }
}

function loadBlogs() {
  return loadRows(
    "site_blogs",
    "adminBlogsList",
    "created_at",
    false,
    "No blogs found.",
    blog => makeCard(
      blog.title,
      "Slug: " + blog.slug + " | " + status(blog),
      [
        makeButton("Edit", () => editBlog(blog)),
        makeButton("Delete", () =>
          deleteRow(
            "site_blogs",
            blog.id,
            "Delete this blog?",
            "blogMessage",
            loadBlogs
          )
        )
      ]
    )
  );
}

function editBlog(blog) {
  fillForm({
    blogId: "id",
    blogTitle: "title",
    blogSlug: "slug",
    blogExcerpt: "excerpt",
    blogContent: "content",
    blogPublished: "published"
  }, blog, "saveBlogButton", "Update Blog", "blogsManager");

  if ($("blogImage")) $("blogImage").value = "";
}

function resetBlog() {
  resetForm("blogForm", "blogId", "saveBlogButton", "Save Blog");
}

// ============================================
// PAGES
// Table: site_pages
// ============================================

async function savePage(event) {
  event.preventDefault();

  const id = val("pageId");
  const title = val("pageTitle");
  const slug = slugify(val("pageSlug") || title);
  const content = val("pageContent");

  if (!title || !slug || !content) {
    showMessage("pageMessage", "Complete all required fields.", true);
    return;
  }

  setBusy("savePageButton", true);

  try {
    await saveRow("site_pages", id, {
      title,
      slug,
      content,
      published: val("pagePublished") === "true",
      updated_at: new Date().toISOString()
    });

    resetPage();
    showMessage("pageMessage", "Page saved successfully.");
    await loadPages();

  } catch (error) {
    report("pageMessage", error);

  } finally {
    setBusy("savePageButton", false, "Save Page");
  }
}

function loadPages() {
  return loadRows(
    "site_pages",
    "adminPagesList",
    "created_at",
    false,
    "No pages found.",
    page => makeCard(
      page.title,
      "URL: " + page.slug + " | " + status(page),
      [
        makeButton("Edit", () => editPage(page)),
        makeButton("Delete", () =>
          deleteRow(
            "site_pages",
            page.id,
            "Delete this page?",
            "pageMessage",
            loadPages
          )
        )
      ]
    )
  );
}

function editPage(page) {
  fillForm({
    pageId: "id",
    pageTitle: "title",
    pageSlug: "slug",
    pageContent: "content",
    pagePublished: "published"
  }, page, "savePageButton", "Update Page", "pagesManager");
}

function resetPage() {
  resetForm("pageForm", "pageId", "savePageButton", "Save Page");
}

// ============================================
// GALLERY
// Table: site_gallery
// ============================================

async function uploadGallery(event) {
  event.preventDefault();

  const file = $("galleryImage")?.files?.[0];

  if (!file) {
    showMessage("galleryMessage", "Choose an image first.", true);
    return;
  }

  setBusy("saveGalleryButton", true);

  try {
    const image_url = await uploadFile(
      file,
      "gallery",
      ["image/jpeg", "image/png", "image/webp"],
      5
    );

    const { error } = await db().from("site_gallery").insert([{
      title: val("galleryTitle") || "Gallery Image",
      description: val("galleryDescription") || null,
      image_url,
      published: true
    }]);

    if (error) throw error;

    $("galleryForm").reset();
    showMessage("galleryMessage", "Image uploaded successfully.");
    await loadGallery();

  } catch (error) {
    report("galleryMessage", error);

  } finally {
    setBusy("saveGalleryButton", false, "Upload Image");
  }
}

function loadGallery() {
  return loadRows(
    "site_gallery",
    "adminGalleryList",
    "created_at",
    false,
    "No gallery images found.",
    item => {
      const card = makeCard(
        item.title || "Gallery Image",
        item.description || "Website gallery image",
        [
          makeButton("Delete", () =>
            deleteRow(
              "site_gallery",
              item.id,
              "Delete this gallery image?",
              "galleryMessage",
              loadGallery
            )
          )
        ]
      );

      const img = document.createElement("img");
      img.src = item.image_url;
      img.alt = item.title || "Gallery image";
      img.loading = "lazy";
      img.style.maxWidth = "180px";
      img.style.height = "auto";
      img.style.borderRadius = "10px";

      card.prepend(img);
      return card;
    }
  );
}

// ============================================
// ANNOUNCEMENTS
// Table: announcements
// Columns: title, content, is_active
// ============================================

async function saveAnnouncement(event) {
  event.preventDefault();

  const title = val("announcementTitle");
  const content = val("announcementContent");

  if (!title || !content) {
    showMessage("announcementMessage", "Enter title and details.", true);
    return;
  }

  const button = $("announcementForm")
    ?.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.textContent = "Publishing...";
  }

  try {
    const { error } = await db().from("announcements").insert([{
      title,
      content,
      is_active: true
    }]);

    if (error) throw error;

    $("announcementForm").reset();
    showMessage("announcementMessage", "Announcement published.");
    await loadAnnouncements();

  } catch (error) {
    report("announcementMessage", error);

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Publish Announcement";
    }
  }
}

function loadAnnouncements() {
  return loadRows(
    "announcements",
    "adminAnnouncementList",
    "created_at",
    false,
    "No announcements found.",
    item => makeCard(
      item.title,
      item.is_active ? "Active" : "Inactive",
      [
        makeButton("Delete", () =>
          deleteRow(
            "announcements",
            item.id,
            "Delete this announcement?",
            "announcementMessage",
            loadAnnouncements
          )
        )
      ]
    )
  );
}

// ============================================
// NAVIGATION
// Table: site_navigation
// Columns: title, url, sort_order, is_active
// ============================================

async function saveNavigation(event) {
  event.preventDefault();

  const id = val("navigationId");
  const title = val("navigationTitle");
  const url = val("navigationUrl");

  if (!title || !url) {
    showMessage("navigationMessage", "Enter menu name and URL.", true);
    return;
  }

  const button = $("navigationForm")
    ?.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    await saveRow("site_navigation", id, {
      title,
      url,
      sort_order: parseInt(val("navigationOrder"), 10) || 0,
      is_active: val("navigationActive") === "true"
    });

    resetNavigation();
    showMessage("navigationMessage", "Menu link saved.");
    await loadNavigation();

  } catch (error) {
    report("navigationMessage", error);

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Save Menu Link";
    }
  }
}

function loadNavigation() {
  return loadRows(
    "site_navigation",
    "adminNavigationList",
    "sort_order",
    true,
    "No menu links found.",
    item => makeCard(
      item.title,
      "URL: " + item.url + " | " +
        (item.is_active ? "Visible" : "Hidden"),
      [
        makeButton("Edit", () => editNavigation(item)),
        makeButton("Delete", () =>
          deleteRow(
            "site_navigation",
            item.id,
            "Delete this menu link?",
            "navigationMessage",
            loadNavigation
          )
        )
      ]
    )
  );
}

function editNavigation(item) {
  fillForm({
    navigationId: "id",
    navigationTitle: "title",
    navigationUrl: "url",
    navigationOrder: "sort_order",
    navigationActive: "is_active"
  }, item, null, null, "navigationManager");
}

function resetNavigation() {
  $("navigationForm")?.reset();
  if ($("navigationId")) $("navigationId").value = "";
}

// ============================================
// WEBSITE SETTINGS
// Table: site_settings
// Columns: setting_key, setting_value
// ============================================

const settingFields = {
  settingSiteName: "site_name",
  settingLogo: "logo_url",
  settingContact: "contact_number",
  settingEmail: "public_email",
  settingWhatsapp: "whatsapp_link",
  settingAbout: "about_text"
};

async function loadSettings() {
  const { data, error } = await db()
    .from("site_settings")
    .select("setting_key, setting_value");

  if (error) {
    report("settingsMessage", error);
    return;
  }

  (data || []).forEach(row => {
    const id = Object.keys(settingFields).find(
      key => settingFields[key] === row.setting_key
    }

  (data || []).forEach(row => {
    const id = Object.keys(settingFields).find(
      key => settingFields[key] === row.setting_key
    );

    if (id && $(id)) {
      $(id).value = row.setting_value || "";
    }
  });
}

async function saveSettings(event) {
  event.preventDefault();

  const button = $("settingsForm")
    ?.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    const rows = Object.entries(settingFields).map(([id, key]) => ({
      setting_key: key,
      setting_value: $(id)?.value?.trim() || ""
    }));

    const { error } = await db()
      .from("site_settings")
      .upsert(rows, { onConflict: "setting_key" });

    if (error) throw error;

    showMessage("settingsMessage", "Website settings saved successfully.");

  } catch (error) {
    report("settingsMessage", error);

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Save Website Settings";
    }
  }
}
