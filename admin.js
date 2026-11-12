// ==========================================
// ADMIN PANEL (short version, same features)
// ==========================================

const db = () => window.supabaseClient;
const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  if (!db()) {
    showMessage("loginMessage", "Database connection failed. Check config.js.", true);
    return;
  }

  [
    ["loginForm", "submit", handleLogin],
    ["logoutButton", "click", handleLogout],
    ["studyNotesForm", "submit", saveStudyNote],
    ["cancelNoteEdit", "click", resetStudyNoteForm],
    ["blogForm", "submit", saveBlog],
    ["cancelBlogEdit", "click", resetBlogForm],
    ["pageForm", "submit", savePage],
    ["cancelPageEdit", "click", resetPageForm],
    ["galleryForm", "submit", uploadGalleryImage],
    ["announcementForm", "submit", publishAnnouncement],
    ["navigationForm", "submit", saveNavigation],
    ["cancelNavigationEdit", "click", resetNavigationForm],
    ["settingsForm", "submit", saveSettings]
  ].forEach(([id, event, callback]) => {
    const el = $(id);
    if (el) el.addEventListener(event, callback);
    else console.warn("Missing HTML element:", id);
  });

  checkExistingSession();
});


// ==========================================
// COMMON HELPERS
// ==========================================

function showMessage(id, message, isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.className = isError ? "form-message error" : "form-message success";
}

function getValue(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function getPublished(id) {
  return getValue(id) === "true";
}

function setButtonLoading(id, loading, normalText) {
  const button = $(id);
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : normalText;
}

function handleError(messageId, error) {
  console.error(error);
  showMessage(messageId, error.message || "Something went wrong. Please try again.", true);
}

function createElement(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text || "";
  if (className) el.className = className;
  return el;
}

function clearList(id, message) {
  const el = $(id);
  if (el) el.replaceChildren(createElement("p", message, "muted"));
}

function makeAdminCard(title, details, actions = []) {
  const card = document.createElement("div");
  card.className = "admin-announcement";
  card.appendChild(createElement("h3", title));
  card.appendChild(createElement("p", details, "muted"));

  if (actions.length) {
    const buttons = document.createElement("div");
    buttons.className = "admin-actions";
    actions.forEach(button => buttons.appendChild(button));
    card.appendChild(buttons);
  }
  return card;
}

function actionButton(label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-dark";
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function safeSlug(value) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addExternalLink(container, url, label) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

async function uploadMedia(file, folder, allowedTypes, maxSizeMB) {
  if (!file) return null;
  if (!allowedTypes.includes(file.type)) throw new Error("This file type is not allowed.");
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error("File size must be " + maxSizeMB + " MB or less.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = folder + "/" + Date.now() + "-" + safeName;

  const { error } = await db().storage.from("site-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = db().storage.from("site-media").getPublicUrl(path);
  return data.publicUrl;
}

// ----- shared database helpers -----

// Insert (no id) or update (with id). Throws on error.
async function saveRecord(table, id, record) {
  const result = id
    ? await db().from(table).update(record).eq("id", id)
    : await db().from(table).insert([record]);
  if (result.error) throw result.error;
}

// Read one column of an existing row (used to keep old file/image URL).
async function getOldValue(table, id, column) {
  const { data, error } = await db().from(table).select(column).eq("id", id).single();
  if (error) throw error;
  return data[column];
}

// Ask, delete a row, show message, reload list.
async function deleteRecord(table, id, question, messageId, doneText, reload) {
  if (!confirm(question)) return;
  const { error } = await db().from(table).delete().eq("id", id);
  if (error) {
    handleError(messageId, error);
    return;
  }
  showMessage(messageId, doneText);
  await reload();
}

// Fetch rows and draw one card per row. buildCard(item) returns a card.
async function loadList(table, listId, emptyText, orderColumn, ascending, buildCard) {
  const list = $(listId);
  if (!list) return;

  const { data, error } = await db().from(table).select("*")
    .order(orderColumn, { ascending });

  if (error) {
    list.textContent = error.message;
    return;
  }
  if (!data.length) {
    clearList(listId, emptyText);
    return;
  }

  list.replaceChildren();
  data.forEach(item => list.appendChild(buildCard(item)));
}

// Fill form fields. map = { elementId: "column" }
function fillForm(map, item, buttonId, buttonText, managerId) {
  Object.entries(map).forEach(([id, key]) => {
    const el = $(id);
    if (!el) return;
    el.value = key === "published" ? String(item[key]) : (item[key] ?? "");
  });
  if ($(buttonId)) $(buttonId).textContent = buttonText;
  const manager = $(managerId);
  if (manager) manager.scrollIntoView({ behavior: "smooth" });
}

function resetForm(formId, idFieldId, buttonId, buttonText) {
  $(formId).reset();
  $(idFieldId).value = "";
  $(buttonId).textContent = buttonText;
}

const statusText = item => item.published ? "Published" : "Draft";


// ==========================================
// LOGIN AND ADMIN VERIFICATION
// ==========================================

async function checkExistingSession() {
  try {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;
    if (data.session) await verifyAdmin(data.session.user);
  } catch (error) {
    handleError("loginMessage", error);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = getValue("email");
  const password = $("password") ? $("password").value : "";

  if (!email || !password) {
    showMessage("loginMessage", "Please enter email and password.", true);
    return;
  }

  const button = document.querySelector("#loginForm button[type='submit']");
  if (button) {
    button.disabled = true;
    button.textContent = "Signing in...";
  }

  showMessage("loginMessage", "Checking login details...");

  try {
    const { data, error } = await db().auth.signInWithPassword({ email, password });
    if (error) throw error;
    await verifyAdmin(data.user);
  } catch (error) {
    handleError("loginMessage", error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
}

async function verifyAdmin(user) {
  try {
    showMessage("loginMessage", "Verifying administrator access...");

    const { data, error } = await db().rpc("is_admin");
    if (error) throw error;

    if (data !== true) {
      await db().auth.signOut();
      showMessage("loginMessage", "Access denied. This account is not an authorized admin.", true);
      return;
    }

    $("loginSection").classList.add("hidden");
    $("dashboardSection").classList.remove("hidden");
    showMessage("loginMessage", "");

    await Promise.all([
      loadStudyNotes(),
      loadBlogs(),
      loadPages(),
      loadGallery(),
      loadAdminAnnouncements(),
      loadNavigation(),
      loadSettings()
    ]);
  } catch (error) {
    handleError("loginMessage", error);
  }
}

async function handleLogout() {
  await db().auth.signOut();
  location.reload();
}


// ==========================================
// STUDY NOTES  (Table: study_materials)
// ==========================================

async function saveStudyNote(event) {
  event.preventDefault();

  const id = getValue("studyNoteId");
  const pdf = $("notePdf").files[0];
  const title = getValue("noteTitle");
  const category = getValue("noteCategory");
  const description = getValue("noteDescription");
  const body = getValue("noteBody");

  if (!title || !category || (!body && !pdf && !id)) {
    showMessage("studyNoteMessage", "Enter title, category and notes content or PDF.", true);
    return;
  }

  setButtonLoading("saveNoteButton", true, "Save Notes");

  try {
    let fileUrl = id ? await getOldValue("study_materials", id, "file_url") : null;

    if (pdf) fileUrl = await uploadMedia(pdf, "study-notes", ["application/pdf"], 10);

    await saveRecord("study_materials", id, {
      title,
      category,
      description: description || null,
      body: body || null,
      file_url: fileUrl,
      published: getPublished("notePublished")
    });

    resetStudyNoteForm();
    showMessage("studyNoteMessage", "Study notes saved successfully!");
    await loadStudyNotes();
  } catch (error) {
    handleError("studyNoteMessage", error);
  } finally {
    setButtonLoading("saveNoteButton", false, "Save Notes");
  }
}

function loadStudyNotes() {
  clearList("adminStudyNotesList", "Loading...");
  return loadList("study_materials", "adminStudyNotesList", "No study notes found.",
    "created_at", false, note => {
      const card = makeAdminCard(
        note.title,
        "Category: " + note.category + " | " + statusText(note),
        [
          actionButton("Edit", () => editStudyNote(note)),
          actionButton("Delete", () => deleteStudyNote(note.id))
        ]
      );
      if (note.description) card.appendChild(createElement("p", note.description));
      addExternalLink(card, note.file_url, "Open PDF");
      return card;
    });
}

function editStudyNote(note) {
  fillForm({
    studyNoteId: "id", noteTitle: "title", noteCategory: "category",
    noteDescription: "description", noteBody: "body", notePublished: "published"
  }, note, "saveNoteButton", "Update Notes", "studyNotesManager");
  $("notePdf").value = "";
}

function deleteStudyNote(id) {
  return deleteRecord("study_materials", id, "Delete these study notes?",
    "studyNoteMessage", "Notes deleted.", loadStudyNotes);
}

function resetStudyNoteForm() {
  resetForm("studyNotesForm", "studyNoteId", "saveNoteButton", "Save Notes");
}


// ==========================================
// BLOGS  (Table: site_blogs)
// ==========================================

async function saveBlog(event) {
  event.preventDefault();

  const id = getValue("blogId");
  const image = $("blogImage").files[0];
  const title = getValue("blogTitle");
  const slug = safeSlug(getValue("blogSlug") || title);
  const excerpt = getValue("blogExcerpt");
  const content = getValue("blogContent");

  if (!title || !slug || !content) {
    showMessage("blogMessage", "Complete all required blog fields.", true);
    return;
  }

  setButtonLoading("saveBlogButton", true, "Save Blog");

  try {
    let imageUrl = id ? await getOldValue("site_blogs", id, "image_url") : null;

    if (image) {
      imageUrl = await uploadMedia(image, "blogs", ["image/jpeg", "image/png", "image/webp"], 5);
    }

    await saveRecord("site_blogs", id, {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      image_url: imageUrl,
      published: getPublished("blogPublished"),
      updated_at: new Date().toISOString()
    });

    resetBlogForm();
    showMessage("blogMessage", "Blog saved successfully!");
    await loadBlogs();
  } catch (error) {
    handleError("blogMessage", error);
  } finally {
    setButtonLoading("saveBlogButton", false, "Save Blog");
  }
}

function loadBlogs() {
  return loadList("site_blogs", "adminBlogsList", "No blogs found.",
    "created_at", false, blog => {
      const card = makeAdminCard(
        blog.title,
        "Slug: " + blog.slug + " | " + statusText(blog),
        [
          actionButton("Edit", () => editBlog(blog)),
          actionButton("Delete", () => deleteBlog(blog.id))
        ]
      );
      addExternalLink(card, blog.image_url, "Open Blog Image");
      return card;
    });
}

function editBlog(blog) {
  fillForm({
    blogId: "id", blogTitle: "title", blogSlug: "slug", blogExcerpt: "excerpt",
    blogContent: "content", blogPublished: "published"
  }, blog, "saveBlogButton", "Update Blog", "blogsManager");
  $("blogImage").value = "";
}

function deleteBlog(id) {
  return deleteRecord("site_blogs", id, "Delete this blog?",
    "blogMessage", "Blog deleted.", loadBlogs);
}

function resetBlogForm() {
  resetForm("blogForm", "blogId", "saveBlogButton", "Save Blog");
}


// ==========================================
// PAGES  (Table: site_pages)
// ==========================================

async function savePage(event) {
  event.preventDefault();

  const id = getValue("pageId");
  const title = getValue("pageTitle");
  const slug = safeSlug(getValue("pageSlug") || title);
  const content = getValue("pageContent");

  if (!title || !slug || !content) {
    showMessage("pageMessage", "Complete all required fields.", true);
    return;
  }

  setButtonLoading("savePageButton", true, "Save Page");

  try {
    await saveRecord("site_pages", id, {
      title,
      slug,
      content,
      published: getPublished("pagePublished"),
      updated_at: new Date().toISOString()
    });

    resetPageForm();
    showMessage("pageMessage", "Page saved successfully!");
    await loadPages();
  } catch (error) {
    handleError("pageMessage", error);
  } finally {
    setButtonLoading("savePageButton", false, "Save Page");
  }
}

function loadPages() {
  return loadList("site_pages", "adminPagesList", "No pages found.",
    "created_at", false, page => makeAdminCard(
      page.title,
      "URL: " + page.slug + " | " + statusText(page),
      [
        actionButton("Edit", () => editPage(page)),
        actionButton("Delete", () => deletePage(page.id))
      ]
    ));
}

function editPage(page) {
  fillForm({
    pageId: "id", pageTitle: "title", pageSlug: "slug",
    pageContent: "content", pagePublished: "published"
  }, page, "savePageButton", "Update Page", "pagesManager");
}

function deletePage(id) {
  return deleteRecord("site_pages", id, "Delete this page?",
    "pageMessage", "Page deleted.", loadPages);
}

function resetPageForm() {
  resetForm("pageForm", "pageId", "savePageButton", "Save Page");
}


// ==========================================
// GALLERY  (Table: site_gallery)
// ==========================================

async function uploadGalleryImage(event) {
  event.preventDefault();

  const file = $("galleryImage").files[0];

  if (!file) {
    showMessage("galleryMessage", "Choose an image first.", true);
    return;
  }

  setButtonLoading("saveGalleryButton", true, "Upload Image");

  try {
    const imageUrl = await uploadMedia(file, "gallery", ["image/jpeg", "image/png", "image/webp"], 5);

    const { error } = await db().from("site_gallery").insert([{
      title: getValue("galleryTitle") || "Gallery Image",
      description: getValue("galleryDescription") || null,
      image_url: imageUrl,
      published: true
    }]);
    if (error) throw error;

    $("galleryForm").reset();
    showMessage("galleryMessage", "Image uploaded successfully!");
    await loadGallery();
  } catch (error) {
    handleError("galleryMessage", error);
  } finally {
    setButtonLoading("saveGalleryButton", false, "Upload Image");
  }
}

function loadGallery() {
  return loadList("site_gallery", "adminGalleryList", "No gallery images found.",
    "created_at", false, item => {
      const card = makeAdminCard(
        item.title || "Gallery Image",
        item.description || "Website gallery image",
        [actionButton("Delete", () => deleteGalleryImage(item.id))]
      );

      const image = document.createElement("img");
      image.src = item.image_url;
      image.alt = item.title || "Gallery image";
      image.loading = "lazy";
      image.style.maxWidth = "180px";
      image.style.height = "auto";
      image.style.borderRadius = "10px";

      card.prepend(image);
      return card;
    });
}

function deleteGalleryImage(id) {
  return deleteRecord("site_gallery", id, "Delete this gallery entry?",
    "galleryMessage", "Gallery image deleted.", loadGallery);
}


// ==========================================================
// ANNOUNCEMENTS, NAVIGATION, SETTINGS
// NOTE: These were missing from your pasted code, so they are
// rebuilt here. If your ORIGINAL file has them, replace this
// block (till the end of the file) with your original versions.
// Table and element names below are assumptions.
// ==========================================================

// ---------- ANNOUNCEMENTS (table: site_announcements) ----------

async function publishAnnouncement(event) {
  event.preventDefault();

  const title = getValue("announcementTitle");
  const message = getValue("announcementBody");

  if (!title || !message) {
    showMessage("announcementMessage", "Enter title and message.", true);
    return;
  }

  setButtonLoading("publishAnnouncementButton", true, "Publish");

  try {
    await saveRecord("site_announcements", "", { title, message, published: true });
    $("announcementForm").reset();
    showMessage("announcementMessage", "Announcement published!");
    await loadAdminAnnouncements();
  } catch (error) {
    handleError("announcementMessage", error);
  } finally {
    setButtonLoading("publishAnnouncementButton", false, "Publish");
  }
}

function loadAdminAnnouncements() {
  return loadList("site_announcements", "adminAnnouncementsList", "No announcements found.",
    "created_at", false, item => {
      const card = makeAdminCard(
        item.title,
        statusText(item),
        [actionButton("Delete", () => deleteAnnouncement(item.id))]
      );
      if (item.message) card.appendChild(createElement("p", item.message));
      return card;
    });
}

function deleteAnnouncement(id) {
  return deleteRecord("site_announcements", id, "Delete this announcement?",
    "announcementMessage", "Announcement deleted.", loadAdminAnnouncements);
}


// ---------- NAVIGATION (table: site_navigation) ----------

async function saveNavigation(event) {
  event.preventDefault();

  const id = getValue("navigationId");
  const label = getValue("navigationLabel");
  const url = getValue("navigationUrl");
  const sortOrder = parseInt(getValue("navigationOrder"), 10) || 0;

  if (!label || !url) {
    showMessage("navigationMessage", "Enter label and URL.", true);
    return;
  }

  setButtonLoading("saveNavigationButton", true, "Save Menu Item");

  try {
    await saveRecord("site_navigation", id, {
      label,
      url,
      sort_order: sortOrder,
      published: getPublished("navigationPublished")
    });

    resetNavigationForm();
    showMessage("navigationMessage", "Menu item saved successfully!");
    await loadNavigation();
  } catch (error) {
    handleError("navigationMessage", error);
  } finally {
    setButtonLoading("saveNavigationButton", false, "Save Menu Item");
  }
}

function loadNavigation() {
  return loadList("site_navigation", "adminNavigationList", "No menu items found.",
    "sort_order", true, item => makeAdminCard(
      item.label,
      "URL: " + item.url + " | " + statusText(item),
      [
        actionButton("Edit", () => editNavigation(item)),
        actionButton("Delete", () => deleteNavigation(item.id))
      ]
    ));
}

function editNavigation(item) {
  fillForm({
    navigationId: "id", navigationLabel: "label", navigationUrl: "url",
    navigationOrder: "sort_order", navigationPublished: "published"
  }, item, "saveNavigationButton", "Update Menu Item", "navigationManager");
}

function deleteNavigation(id) {
  return deleteRecord("site_navigation", id, "Delete this menu item?",
    "navigationMessage", "Menu item deleted.", loadNavigation);
}

function resetNavigationForm() {
  resetForm("navigationForm", "navigationId", "saveNavigationButton", "Save Menu Item");
}


// ---------- SETTINGS (table: site_settings, columns: key, value) ----------
// Each input in #settingsForm must have a name attribute equal to its key.

async function loadSettings() {
  const form = $("settingsForm");
  if (!form) return;

  const { data, error } = await db().from("site_settings").select("*");
  if (error) {
    handleError("settingsMessage", error);
    return;
  }

  (data || []).forEach(row => {
    const field = form.elements[row.key];
    if (field) field.value = row.value || "";
  });
}

async function saveSettings(event) {
  event.preventDefault();

  setButtonLoading("saveSettingsButton", true, "Save Settings");

  try {
    const rows = Array.from($("settingsForm").elements)
      .filter(field => field.name)
      .map(field => ({ key: field.name, value: field.value.trim() }));

    if (rows.length) {
      const { error } = await db().from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    }

    showMessage("settingsMessage", "Settings saved successfully!");
  } catch (error) {
    handleError("settingsMessage", error);
  } finally {
    setButtonLoading("saveSettingsButton", false, "Save Settings");
    (() => {
// ==========================================
// ADMIN PANEL (short version, same features)
// ==========================================

const db = () => window.supabaseClient;
const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  if (!db()) {
    showMessage("loginMessage", "Database connection failed. Check config.js.", true);
    return;
  }

  [
    ["loginForm", "submit", handleLogin],
    ["logoutButton", "click", handleLogout],
    ["studyNotesForm", "submit", saveStudyNote],
    ["cancelNoteEdit", "click", resetStudyNoteForm],
    ["blogForm", "submit", saveBlog],
    ["cancelBlogEdit", "click", resetBlogForm],
    ["pageForm", "submit", savePage],
    ["cancelPageEdit", "click", resetPageForm],
    ["galleryForm", "submit", uploadGalleryImage],
    ["announcementForm", "submit", publishAnnouncement],
    ["navigationForm", "submit", saveNavigation],
    ["cancelNavigationEdit", "click", resetNavigationForm],
    ["settingsForm", "submit", saveSettings]
  ].forEach(([id, event, callback]) => {
    const el = $(id);
    if (el) el.addEventListener(event, callback);
    else console.warn("Missing HTML element:", id);
  });

  checkExistingSession();
});


// ==========================================
// COMMON HELPERS
// ==========================================

function showMessage(id, message, isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.className = isError ? "form-message error" : "form-message success";
}

function getValue(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function getPublished(id) {
  return getValue(id) === "true";
}

function setButtonLoading(id, loading, normalText) {
  const button = $(id);
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : normalText;
}

function handleError(messageId, error) {
  console.error(error);
  showMessage(messageId, error.message || "Something went wrong. Please try again.", true);
}

function createElement(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text || "";
  if (className) el.className = className;
  return el;
}

function clearList(id, message) {
  const el = $(id);
  if (el) el.replaceChildren(createElement("p", message, "muted"));
}

function makeAdminCard(title, details, actions = []) {
  const card = document.createElement("div");
  card.className = "admin-announcement";
  card.appendChild(createElement("h3", title));
  card.appendChild(createElement("p", details, "muted"));

  if (actions.length) {
    const buttons = document.createElement("div");
    buttons.className = "admin-actions";
    actions.forEach(button => buttons.appendChild(button));
    card.appendChild(buttons);
  }
  return card;
}

function actionButton(label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-dark";
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function safeSlug(value) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addExternalLink(container, url, label) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

async function uploadMedia(file, folder, allowedTypes, maxSizeMB) {
  if (!file) return null;
  if (!allowedTypes.includes(file.type)) throw new Error("This file type is not allowed.");
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error("File size must be " + maxSizeMB + " MB or less.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = folder + "/" + Date.now() + "-" + safeName;

  const { error } = await db().storage.from("site-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = db().storage.from("site-media").getPublicUrl(path);
  return data.publicUrl;
}

// ----- shared database helpers -----

// Insert (no id) or update (with id). Throws on error.
async function saveRecord(table, id, record) {
  const result = id
    ? await db().from(table).update(record).eq("id", id)
    : await db().from(table).insert([record]);
  if (result.error) throw result.error;
}

// Read one column of an existing row (used to keep old file/image URL).
async function getOldValue(table, id, column) {
  const { data, error } = await db().from(table).select(column).eq("id", id).single();
  if (error) throw error;
  return data[column];
}

// Ask, delete a row, show message, reload list.
async function deleteRecord(table, id, question, messageId, doneText, reload) {
  if (!confirm(question)) return;
  const { error } = await db().from(table).delete().eq("id", id);
  if (error) {
    handleError(messageId, error);
    return;
  }
  showMessage(messageId, doneText);
  await reload();
}

// Fetch rows and draw one card per row. buildCard(item) returns a card.
async function loadList(table, listId, emptyText, orderColumn, ascending, buildCard) {
  const list = $(listId);
  if (!list) return;

  const { data, error } = await db().from(table).select("*")
    .order(orderColumn, { ascending });

  if (error) {
    list.textContent = error.message;
    return;
  }
  if (!data.length) {
    clearList(listId, emptyText);
    return;
  }

  list.replaceChildren();
  data.forEach(item => list.appendChild(buildCard(item)));
}

// Fill form fields. map = { elementId: "column" }
function fillForm(map, item, buttonId, buttonText, managerId) {
  Object.entries(map).forEach(([id, key]) => {
    const el = $(id);
    if (!el) return;
    el.value = key === "published" ? String(item[key]) : (item[key] ?? "");
  });
  if ($(buttonId)) $(buttonId).textContent = buttonText;
  const manager = $(managerId);
  if (manager) manager.scrollIntoView({ behavior: "smooth" });
}

function resetForm(formId, idFieldId, buttonId, buttonText) {
  $(formId).reset();
  $(idFieldId).value = "";
  $(buttonId).textContent = buttonText;
}

const statusText = item => item.published ? "Published" : "Draft";


// ==========================================
// LOGIN AND ADMIN VERIFICATION
// ==========================================

async function checkExistingSession() {
  try {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;
    if (data.session) await verifyAdmin(data.session.user);
  } catch (error) {
    handleError("loginMessage", error);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = getValue("email");
  const password = $("password") ? $("password").value : "";

  if (!email || !password) {
    showMessage("loginMessage", "Please enter email and password.", true);
    return;
  }

  const button = document.querySelector("#loginForm button[type='submit']");
  if (button) {
    button.disabled = true;
    button.textContent = "Signing in...";
  }

  showMessage("loginMessage", "Checking login details...");

  try {
    const { data, error } = await db().auth.signInWithPassword({ email, password });
    if (error) throw error;
    await verifyAdmin(data.user);
  } catch (error) {
    handleError("loginMessage", error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
}

async function verifyAdmin(user) {
  try {
    showMessage("loginMessage", "Verifying administrator access...");

    const { data, error } = await db().rpc("is_admin");
    if (error) throw error;

    if (data !== true) {
      await db().auth.signOut();
      showMessage("loginMessage", "Access denied. This account is not an authorized admin.", true);
      return;
    }

    $("loginSection").classList.add("hidden");
    $("dashboardSection").classList.remove("hidden");
    showMessage("loginMessage", "");

    await Promise.all([
      loadStudyNotes(),
      loadBlogs(),
      loadPages(),
      loadGallery(),
      loadAdminAnnouncements(),
      loadNavigation(),
      loadSettings()
    ]);
  } catch (error) {
    handleError("loginMessage", error);
  }
}

async function handleLogout() {
  await db().auth.signOut();
  location.reload();
}


// ==========================================
// STUDY NOTES  (Table: study_materials)
// ==========================================

async function saveStudyNote(event) {
  event.preventDefault();

  const id = getValue("studyNoteId");
  const pdf = $("notePdf").files[0];
  const title = getValue("noteTitle");
  const category = getValue("noteCategory");
  const description = getValue("noteDescription");
  const body = getValue("noteBody");

  if (!title || !category || (!body && !pdf && !id)) {
    showMessage("studyNoteMessage", "Enter title, category and notes content or PDF.", true);
    return;
  }

  setButtonLoading("saveNoteButton", true, "Save Notes");

  try {
    let fileUrl = id ? await getOldValue("study_materials", id, "file_url") : null;

    if (pdf) fileUrl = await uploadMedia(pdf, "study-notes", ["application/pdf"], 10);

    await saveRecord("study_materials", id, {
      title,
      category,
      description: description || null,
      body: body || null,
      file_url: fileUrl,
      published: getPublished("notePublished")
    });

    resetStudyNoteForm();
    showMessage("studyNoteMessage", "Study notes saved successfully!");
    await loadStudyNotes();
  } catch (error) {
    handleError("studyNoteMessage", error);
  } finally {
    setButtonLoading("saveNoteButton", false, "Save Notes");
  }
}

function loadStudyNotes() {
  clearList("adminStudyNotesList", "Loading...");
  return loadList("study_materials", "adminStudyNotesList", "No study notes found.",
    "created_at", false, note => {
      const card = makeAdminCard(
        note.title,
        "Category: " + note.category + " | " + statusText(note),
        [
          actionButton("Edit", () => editStudyNote(note)),
          actionButton("Delete", () => deleteStudyNote(note.id))
        ]
      );
      if (note.description) card.appendChild(createElement("p", note.description));
      addExternalLink(card, note.file_url, "Open PDF");
      return card;
    });
}

function editStudyNote(note) {
  fillForm({
    studyNoteId: "id", noteTitle: "title", noteCategory: "category",
    noteDescription: "description", noteBody: "body", notePublished: "published"
  }, note, "saveNoteButton", "Update Notes", "studyNotesManager");
  $("notePdf").value = "";
}

function deleteStudyNote(id) {
  return deleteRecord("study_materials", id, "Delete these study notes?",
    "studyNoteMessage", "Notes deleted.", loadStudyNotes);
}

function resetStudyNoteForm() {
  resetForm("studyNotesForm", "studyNoteId", "saveNoteButton", "Save Notes");
}


// ==========================================
// BLOGS  (Table: site_blogs)
// ==========================================

async function saveBlog(event) {
  event.preventDefault();

  const id = getValue("blogId");
  const image = $("blogImage").files[0];
  const title = getValue("blogTitle");
  const slug = safeSlug(getValue("blogSlug") || title);
  const excerpt = getValue("blogExcerpt");
  const content = getValue("blogContent");

  if (!title || !slug || !content) {
    showMessage("blogMessage", "Complete all required blog fields.", true);
    return;
  }

  setButtonLoading("saveBlogButton", true, "Save Blog");

  try {
    let imageUrl = id ? await getOldValue("site_blogs", id, "image_url") : null;

    if (image) {
      imageUrl = await uploadMedia(image, "blogs", ["image/jpeg", "image/png", "image/webp"], 5);
    }

    await saveRecord("site_blogs", id, {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      image_url: imageUrl,
      published: getPublished("blogPublished"),
      updated_at: new Date().toISOString()
    });

    resetBlogForm();
    showMessage("blogMessage", "Blog saved successfully!");
    await loadBlogs();
  } catch (error) {
    handleError("blogMessage", error);
  } finally {
    setButtonLoading("saveBlogButton", false, "Save Blog");
  }
}

function loadBlogs() {
  return loadList("site_blogs", "adminBlogsList", "No blogs found.",
    "created_at", false, blog => {
      const card = makeAdminCard(
        blog.title,
        "Slug: " + blog.slug + " | " + statusText(blog),
        [
          actionButton("Edit", () => editBlog(blog)),
          actionButton("Delete", () => deleteBlog(blog.id))
        ]
      );
      addExternalLink(card, blog.image_url, "Open Blog Image");
      return card;
    });
}

function editBlog(blog) {
  fillForm({
    blogId: "id", blogTitle: "title", blogSlug: "slug", blogExcerpt: "excerpt",
    blogContent: "content", blogPublished: "published"
  }, blog, "saveBlogButton", "Update Blog", "blogsManager");
  $("blogImage").value = "";
}

function deleteBlog(id) {
  return deleteRecord("site_blogs", id, "Delete this blog?",
    "blogMessage", "Blog deleted.", loadBlogs);
}

function resetBlogForm() {
  resetForm("blogForm", "blogId", "saveBlogButton", "Save Blog");
}


// ==========================================
// PAGES  (Table: site_pages)
// ==========================================

async function savePage(event) {
  event.preventDefault();

  const id = getValue("pageId");
  const title = getValue("pageTitle");
  const slug = safeSlug(getValue("pageSlug") || title);
  const content = getValue("pageContent");

  if (!title || !slug || !content) {
    showMessage("pageMessage", "Complete all required fields.", true);
    return;
  }

  setButtonLoading("savePageButton", true, "Save Page");

  try {
    await saveRecord("site_pages", id, {
      title,
      slug,
      content,
      published: getPublished("pagePublished"),
      updated_at: new Date().toISOString()
    });

    resetPageForm();
    showMessage("pageMessage", "Page saved successfully!");
    await loadPages();
  } catch (error) {
    handleError("pageMessage", error);
  } finally {
    setButtonLoading("savePageButton", false, "Save Page");
  }
}

function loadPages() {
  return loadList("site_pages", "adminPagesList", "No pages found.",
    "created_at", false, page => makeAdminCard(
      page.title,
      "URL: " + page.slug + " | " + statusText(page),
      [
        actionButton("Edit", () => editPage(page)),
        actionButton("Delete", () => deletePage(page.id))
      ]
    ));
}

function editPage(page) {
  fillForm({
    pageId: "id", pageTitle: "title", pageSlug: "slug",
    pageContent: "content", pagePublished: "published"
  }, page, "savePageButton", "Update Page", "pagesManager");
}

function deletePage(id) {
  return deleteRecord("site_pages", id, "Delete this page?",
    "pageMessage", "Page deleted.", loadPages);
}

function resetPageForm() {
  resetForm("pageForm", "pageId", "savePageButton", "Save Page");
}


// ==========================================
// GALLERY  (Table: site_gallery)
// ==========================================

async function uploadGalleryImage(event) {
  event.preventDefault();

  const file = $("galleryImage").files[0];

  if (!file) {
    showMessage("galleryMessage", "Choose an image first.", true);
    return;
  }

  setButtonLoading("saveGalleryButton", true, "Upload Image");

  try {
    const imageUrl = await uploadMedia(file, "gallery", ["image/jpeg", "image/png", "image/webp"], 5);

    const { error } = await db().from("site_gallery").insert([{
      title: getValue("galleryTitle") || "Gallery Image",
      description: getValue("galleryDescription") || null,
      image_url: imageUrl,
      published: true
    }]);
    if (error) throw error;

    $("galleryForm").reset();
    showMessage("galleryMessage", "Image uploaded successfully!");
    await loadGallery();
  } catch (error) {
    handleError("galleryMessage", error);
  } finally {
    setButtonLoading("saveGalleryButton", false, "Upload Image");
  }
}

function loadGallery() {
  return loadList("site_gallery", "adminGalleryList", "No gallery images found.",
    "created_at", false, item => {
      const card = makeAdminCard(
        item.title || "Gallery Image",
        item.description || "Website gallery image",
        [actionButton("Delete", () => deleteGalleryImage(item.id))]
      );

      const image = document.createElement("img");
      image.src = item.image_url;
      image.alt = item.title || "Gallery image";
      image.loading = "lazy";
      image.style.maxWidth = "180px";
      image.style.height = "auto";
      image.style.borderRadius = "10px";

      card.prepend(image);
      return card;
    });
}

function deleteGalleryImage(id) {
  return deleteRecord("site_gallery", id, "Delete this gallery entry?",
    "galleryMessage", "Gallery image deleted.", loadGallery);
}


// ==========================================================
// ANNOUNCEMENTS, NAVIGATION, SETTINGS
// NOTE: These were missing from your pasted code, so they are
// rebuilt here. If your ORIGINAL file has them, replace this
// block (till the end of the file) with your original versions.
// Table and element names below are assumptions.
// ==========================================================

// ---------- ANNOUNCEMENTS (table: site_announcements) ----------

async function publishAnnouncement(event) {
  event.preventDefault();

  const title = getValue("announcementTitle");
  const message = getValue("announcementBody");

  if (!title || !message) {
    showMessage("announcementMessage", "Enter title and message.", true);
    return;
  }

  setButtonLoading("publishAnnouncementButton", true, "Publish");

  try {
    await saveRecord("site_announcements", "", { title, message, published: true });
    $("announcementForm").reset();
    showMessage("announcementMessage", "Announcement published!");
    await loadAdminAnnouncements();
  } catch (error) {
    handleError("announcementMessage", error);
  } finally {
    setButtonLoading("publishAnnouncementButton", false, "Publish");
  }
}

function loadAdminAnnouncements() {
  return loadList("site_announcements", "adminAnnouncementsList", "No announcements found.",
    "created_at", false, item => {
      const card = makeAdminCard(
        item.title,
        statusText(item),
        [actionButton("Delete", () => deleteAnnouncement(item.id))]
      );
      if (item.message) card.appendChild(createElement("p", item.message));
      return card;
    });
}

function deleteAnnouncement(id) {
  return deleteRecord("site_announcements", id, "Delete this announcement?",
    "announcementMessage", "Announcement deleted.", loadAdminAnnouncements);
}


// ---------- NAVIGATION (table: site_navigation) ----------

async function saveNavigation(event) {
  event.preventDefault();

  const id = getValue("navigationId");
  const label = getValue("navigationLabel");
  const url = getValue("navigationUrl");
  const sortOrder = parseInt(getValue("navigationOrder"), 10) || 0;

  if (!label || !url) {
    showMessage("navigationMessage", "Enter label and URL.", true);
    return;
  }

  setButtonLoading("saveNavigationButton", true, "Save Menu Item");

  try {
    await saveRecord("site_navigation", id, {
      label,
      url,
      sort_order: sortOrder,
      published: getPublished("navigationPublished")
    });

    resetNavigationForm();
    showMessage("navigationMessage", "Menu item saved successfully!");
    await loadNavigation();
  } catch (error) {
    handleError("navigationMessage", error);
  } finally {
    setButtonLoading("saveNavigationButton", false, "Save Menu Item");
  }
}

function loadNavigation() {
  return loadList("site_navigation", "adminNavigationList", "No menu items found.",
    "sort_order", true, item => makeAdminCard(
      item.label,
      "URL: " + item.url + " | " + statusText(item),
      [
        actionButton("Edit", () => editNavigation(item)),
        actionButton("Delete", () => deleteNavigation(item.id))
      ]
    ));
}

function editNavigation(item) {
  fillForm({
    navigationId: "id", navigationLabel: "label", navigationUrl: "url",
    navigationOrder: "sort_order", navigationPublished: "published"
  }, item, "saveNavigationButton", "Update Menu Item", "navigationManager");
}

function deleteNavigation(id) {
  return deleteRecord("site_navigation", id, "Delete this menu item?",
    "navigationMessage", "Menu item deleted.", loadNavigation);
}

function resetNavigationForm() {
  resetForm("navigationForm", "navigationId", "saveNavigationButton", "Save Menu Item");
}


// ---------- SETTINGS (table: site_settings, columns: key, value) ----------
// Each input in #settingsForm must have a name attribute equal to its key.

async function loadSettings() {
  const form = $("settingsForm");
  if (!form) return;

  const { data, error } = await db().from("site_settings").select("*");
  if (error) {
    handleError("settingsMessage", error);
    return;
  }

  (data || []).forEach(row => {
    const field = form.elements[row.key];
    if (field) field.value = row.value || "";
  });
}

async function saveSettings(event) {
  event.preventDefault();

  setButtonLoading("saveSettingsButton", true, "Save Settings");

  try {
    const rows = Array.from($("settingsForm").elements)
      .filter(field => field.name)
      .map(field => ({ key: field.name, value: field.value.trim() }));

    if (rows.length) {
      const { error } = await db().from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    }

    showMessage("settingsMessage", "Settings saved successfully!");
  } catch (error) {
    handleError("settingsMessage", error);
  } finally {
    setButtonLoading("saveSettingsButton", false, "Save Settings");
  }
}
