JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const db = window.supabaseClient;

  if (!db) {
    showMessage("loginMessage", "Database connection failed. Check config.js.", true);
    return;
  }

  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("logoutButton").addEventListener("click", handleLogout);

  document.getElementById("studyNotesForm").addEventListener("submit", saveStudyNote);
  document.getElementById("cancelNoteEdit").addEventListener("click", resetStudyNoteForm);

  document.getElementById("blogForm").addEventListener("submit", saveBlog);
  document.getElementById("cancelBlogEdit").addEventListener("click", resetBlogForm);

  document.getElementById("pageForm").addEventListener("submit", savePage);
  document.getElementById("cancelPageEdit").addEventListener("click", resetPageForm);

  document.getElementById("galleryForm").addEventListener("submit", uploadGalleryImage);

  document.getElementById("announcementForm").addEventListener("submit", publishAnnouncement);

  document.getElementById("navigationForm").addEventListener("submit", saveNavigation);
  document.getElementById("cancelNavigationEdit").addEventListener("click", resetNavigationForm);

  document.getElementById("settingsForm").addEventListener("submit", saveSettings);

  checkExistingSession();
});


// ============================================
// COMMON HELPERS
// ============================================

function showMessage(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = message;
  el.className = isError
    ? "form-message error"
    : "form-message success";
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function getPublished(id) {
  return document.getElementById(id).value === "true";
}

function setButtonLoading(id, loading, normalText) {
  const button = document.getElementById(id);
  button.disabled = loading;
  if (loading) button.textContent = "Please wait...";
  else button.textContent = normalText;
}

function createElement(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text || "";
  if (className) el.className = className;
  return el;
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

function clearList(id, message) {
  const el = document.getElementById(id);
  el.replaceChildren(createElement("p", message, "muted"));
}

function safeSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uploadMedia(file, folder, allowedTypes, maxSizeMB) {
  if (!file) return null;

  if (!allowedTypes.includes(file.type)) {
    throw new Error("This file type is not allowed.");
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error("File size must be " + maxSizeMB + " MB or less.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = folder + "/" + crypto.randomUUID() + "-" + safeName;

  const { error } = await window.supabaseClient.storage
    .from("site-media")
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = window.supabaseClient.storage
    .from("site-media")
    .getPublicUrl(path);

  return data.publicUrl;
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


// ============================================
// LOGIN AND ADMIN VERIFICATION
// ============================================

async function checkExistingSession() {
  const { data, error } =
    await window.supabaseClient.auth.getSession();

  if (error) {
    showMessage("loginMessage", error.message, true);
    return;
  }

  if (data.session) {
    await verifyAdmin(data.session.user);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = getValue("email");
  const password = document.getElementById("password").value;

  showMessage("loginMessage", "Signing in...");

  const { data, error } =
    await window.supabaseClient.auth.signInWithPassword({
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
  const { data, error } =
    await window.supabaseClient.rpc("is_admin");

  if (error || data !== true) {
    await window.supabaseClient.auth.signOut();

    showMessage(
      "loginMessage",
      "Access denied. This account is not an authorized admin.",
      true
    );
    return;
  }

  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("dashboardSection").classList.remove("hidden");

  await Promise.all([
    loadStudyNotes(),
    loadBlogs(),
    loadPages(),
    loadGallery(),
    loadAdminAnnouncements(),
    loadNavigation(),
    loadSettings()
  ]);
}

async function handleLogout() {
  await window.supabaseClient.auth.signOut();
  location.reload();
}


// ============================================
// STUDY NOTES
// Existing table: study_materials
// ============================================

async function saveStudyNote(event) {
  event.preventDefault();

  const id = getValue("studyNoteId");
  const pdf = document.getElementById("notePdf").files[0];

  const title = getValue("noteTitle");
  const category = getValue("noteCategory");
  const description = getValue("noteDescription");
  const body = getValue("noteBody");
  const published = getPublished("notePublished");

  if (!title || !category || (!body && !pdf && !id)) {
    showMessage("studyNoteMessage", "Enter title, category and notes content or PDF.", true);
    return;
  }

  setButtonLoading("saveNoteButton", true, "Save Notes");

  try {
    let fileUrl = null;

    if (id) {
      const { data, error } = await window.supabaseClient
        .from("study_materials")
        .select("file_url")
        .eq("id", id)
        .single();

      if (error) throw error;
      fileUrl = data.file_url;
    }

    if (pdf) {
      fileUrl = await uploadMedia(
        pdf,
        "study-notes",
        ["application/pdf"],
        10
      );
    }

    const note = {
      title,
      category,
      description: description || null,
      body: body || null,
      file_url: fileUrl,
      published
    };

    const result = id
      ? await window.supabaseClient.from("study_materials").update(note).eq("id", id)
      : await window.supabaseClient.from("study_materials").insert([note]);

    if (result.error) throw result.error;

    resetStudyNoteForm();
    showMessage("studyNoteMessage", "Study notes saved successfully!");
    await loadStudyNotes();

  } catch (error) {
    showMessage("studyNoteMessage", error.message, true);
  } finally {
    setButtonLoading("saveNoteButton", false, "Save Notes");
  }
}

async function loadStudyNotes() {
  const list = document.getElementById("adminStudyNotesList");
  clearList("adminStudyNotesList", "Loading...");

  const { data, error } = await window.supabaseClient
    .from("study_materials")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = "Could not load notes: " + error.message;
    return;
  }

  if (!data.length) {
    clearList("adminStudyNotesList", "No study notes found.");
    return;
  }

  list.replaceChildren();

  data.forEach(note => {
    const edit = actionButton("Edit", () => editStudyNote(note));
    const remove = actionButton("Delete", () => deleteStudyNote(note.id));

    const card = makeAdminCard(
      note.title,
      "Category: " + note.category + " | " +
      (note.published ? "Published" : "Draft"),
      [edit, remove]
    );

    if (note.description) {
      card.appendChild(createElement("p", note.description));
    }

    addExternalLink(card, note.file_url, "Open PDF");
    list.appendChild(card);
  });
}

function editStudyNote(note) {
  document.getElementById("studyNoteId").value = note.id;
  document.getElementById("noteTitle").value = note.title || "";
  document.getElementById("noteCategory").value = note.category || "";
  document.getElementById("noteDescription").value = note.description || "";
  document.getElementById("noteBody").value = note.body || "";
  document.getElementById("notePublished").value = String(note.published);
  document.getElementById("notePdf").value = "";

  document.getElementById("saveNoteButton").textContent = "Update Notes";
  document.getElementById("studyNotesManager").scrollIntoView({ behavior: "smooth" });
}

async function deleteStudyNote(id) {
  if (!confirm("Delete these study notes?")) return;

  const { error } = await window.supabaseClient
    .from("study_materials")
    .delete()
    .eq("id", id);

  if (error) {
    showMessage("studyNoteMessage", error.message, true);
    return;
  }

  showMessage("studyNoteMessage", "Notes deleted.");
  await loadStudyNotes();
}

function resetStudyNoteForm() {
  document.getElementById("studyNotesForm").reset();
  document.getElementById("studyNoteId").value = "";
  document.getElementById("saveNoteButton").textContent = "Save Notes";
}


// ============================================
// BLOGS
// Table: site_blogs
// ============================================

async function saveBlog(event) {
  event.preventDefault();

  const id = getValue("blogId");
  const image = document.getElementById("blogImage").files[0];

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
    let imageUrl = null;

    if (id) {
      const { data, error } = await window.supabaseClient
        .from("site_blogs")
        .select("image_url")
        .eq("id", id)
        .single();

      if (error) throw error;
      imageUrl = data.image_url;
    }

    if (image) {
      imageUrl = await uploadMedia(
        image,
        "blogs",
        ["image/jpeg", "image/png", "image/webp"],
        5
      );
    }

    const blog = {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      image_url: imageUrl,
      published: getPublished("blogPublished"),
      updated_at: new Date().toISOString()
    };

    const result = id
      ? await window.supabaseClient.from("site_blogs").update(blog).eq("id", id)
      : await window.supabaseClient.from("site_blogs").insert([blog]);

    if (result.error) throw result.error;

    resetBlogForm();
    showMessage("blogMessage", "Blog saved successfully!");
    await loadBlogs();

  } catch (error) {
    showMessage("blogMessage", error.message, true);
  } finally {
    setButtonLoading("saveBlogButton", false, "Save Blog");
  }
}

async function loadBlogs() {
  const list = document.getElementById("adminBlogsList");

  const { data, error } = await window.supabaseClient
    .from("site_blogs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  if (!data.length) {
    clearList("adminBlogsList", "No blogs found.");
    return;
  }

  list.replaceChildren();

  data.forEach(blog => {
    const card = makeAdminCard(
      blog.title,
      "Slug: " + blog.slug + " | " + (blog.published ? "Published" : "Draft"),
      [
        actionButton("Edit", () => editBlog(blog)),
        actionButton("Delete", () => deleteBlog(blog.id))
      ]
    );

    addExternalLink(card, blog.image_url, "Open Blog Image");
    list.appendChild(card);
  });
}

function editBlog(blog) {
  document.getElementById("blogId").value = blog.id;
  document.getElementById("blogTitle").value = blog.title || "";
  document.getElementById("blogSlug").value = blog.slug || "";
  document.getElementById("blogExcerpt").value = blog.excerpt || "";
  document.getElementById("blogContent").value = blog.content || "";
  document.getElementById("blogPublished").value = String(blog.published);
  document.getElementById("blogImage").value = "";
  document.getElementById("saveBlogButton").textContent = "Update Blog";

  document.getElementById("blogsManager").scrollIntoView({ behavior: "smooth" });
}

async function deleteBlog(id) {
  if (!confirm("Delete this blog?")) return;

  const { error } = await window.supabaseClient
    .from("site_blogs")
    .delete()
    .eq("id", id);

  if (error) {
    showMessage("blogMessage", error.message, true);
    return;
  }

  showMessage("blogMessage", "Blog deleted.");
  await loadBlogs();
}

function resetBlogForm() {
  document.getElementById("blogForm").reset();
  document.getElementById("blogId").value = "";
  document.getElementById("saveBlogButton").textContent = "Save Blog";
}


// ============================================
// PAGES
// Table: site_pages
// ============================================

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
    const page = {
      title,
      slug,
      content,
      published: getPublished("pagePublished"),
      updated_at: new Date().toISOString()
    };

    const result = id
      ? await window.supabaseClient.from("site_pages").update(page).eq("id", id)
      : await window.supabaseClient.from("site_pages").insert([page]);

    if (result.error) throw result.error;

    resetPageForm();
    showMessage("pageMessage", "Page saved successfully!");
    await loadPages();

  } catch (error) {
    showMessage("pageMessage", error.message, true);
  } finally {
    setButtonLoading("savePageButton", false, "Save Page");
  }
}

async function loadPages() {
  const list = document.getElementById("adminPagesList");

  const { data, error } = await window.supabaseClient
    .from("site_pages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  if (!data.length) {
    clearList("adminPagesList", "No pages found.");
    return;
  }

  list.replaceChildren();

  data.forEach(page => {
    list.appendChild(makeAdminCard(
      page.title,
      "URL: " + page.slug + " | " + (page.published ? "Published" : "Draft"),
      [
        actionButton("Edit", () => editPage(page)),
        actionButton("Delete", () => deletePage(page.id))
      ]
    ));
  });
}

function editPage(page) {
  document.getElementById("pageId").value = page.id;
  document.getElementById("pageTitle").value = page.title || "";
  document.getElementById("pageSlug").value = page.slug || "";
  document.getElementById("pageContent").value = page.content || "";
  document.getElementById("pagePublished").value = String(page.published);
  document.getElementById("savePageButton").textContent = "Update Page";

  document.getElementById("pagesManager").scrollIntoView({ behavior: "smooth" });
}

async function deletePage(id) {
  if (!confirm("Delete this page?")) return;

  const { error } = await window.supabaseClient
    .from("site_pages")
    .delete()
    .eq("id", id);

  if (error) {
    showMessage("pageMessage", error.message, true);
    return;
  }

  showMessage("pageMessage", "Page deleted.");
  await loadPages();
}

function resetPageForm() {
  document.getElementById("pageForm").reset();
  document.getElementById("pageId").value = "";
  document.getElementById("savePageButton").textContent = "Save Page";
}


// ============================================
// GALLERY
// Table: site_gallery
// ============================================

async function uploadGalleryImage(event) {
  event.preventDefault();

  const file = document.getElementById("galleryImage").files[0];

  if (!file) {
    showMessage("galleryMessage", "Choose an image first.", true);
    return;
  }

  setButtonLoading("saveGalleryButton", true, "Upload Image");

  try {
    const imageUrl = await uploadMedia(
      file,
      "gallery",
      ["image/jpeg", "image/png", "image/webp"],
      5
    );

    const { error } = await window.supabaseClient
      .from("site_gallery")
      .insert([{
        title: getValue("galleryTitle") || "Gallery Image",
        description: getValue("galleryDescription") || null,
        image_url: imageUrl,
        published: true
      }]);

    if (error) throw error;

    document.getElementById("galleryForm").reset();
    showMessage("galleryMessage", "Image uploaded successfully!");
    await loadGallery();

  } catch (error) {
    showMessage("galleryMessage", error.message, true);
  } finally {
    setButtonLoading("saveGalleryButton", false, "Upload Image");
  }
}

async function loadGallery() {
  const list = document.getElementById("adminGalleryList");

  const { data, error } = await window.supabaseClient
    .from("site_gallery")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  if (!data.length) {
    clearList("adminGalleryList", "No gallery images found.");
    return;
  }

  list.replaceChildren();

  data.forEach(item => {
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
    list.appendChild(card);
  });
}

async function deleteGalleryImage(id) {
  if (!confirm("Delete this gallery entry?")) return;

  const { error } = await window.supabaseClient
    .from("site_gallery")
    .delete()
    .eq("id", id);

  if (error) {
    showMessage("galleryMessage", error.message, true);
    return;
  }

  showMessage("galleryMessage", "Gallery entry deleted.");
  await loadGallery();
}


// ============================================
// ANNOUNCEMENTS
// Existing table: announcements
// ============================================

async function publishAnnouncement(event) {
  event.preventDefault();

  const title = getValue("announcementTitle");
  const content = getValue("announcementContent");

  if (!title || !content) {
    showMessage("announcementMessage", "Complete both fields.", true);
    return;
  }

  showMessage("announcementMessage", "Publishing...");

  const { error } = await window.supabaseClient
    .from("announcements")
    .insert([{ title, content, is_active: true }]);

  if (error) {
    showMessage(
