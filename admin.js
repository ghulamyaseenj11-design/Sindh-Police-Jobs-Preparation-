
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const logoutButton = document.getElementById("logoutButton");
  const announcementForm = document.getElementById("announcementForm");
  const studyNotesForm = document.getElementById("studyNotesForm");
  const cancelNoteEdit = document.getElementById("cancelNoteEdit");

  if (!window.supabaseClient) {
    showMessage(
      "loginMessage",
      "Database is not connected. Please configure config.js.",
      true
    );
    return;
  }

  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  announcementForm.addEventListener("submit", publishAnnouncement);
  studyNotesForm.addEventListener("submit", saveStudyNote);
  cancelNoteEdit.addEventListener("click", resetStudyNoteForm);

  checkExistingSession();
});


// =====================================
// COMMON MESSAGE FUNCTION
// =====================================

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.className = isError
    ? "form-message error"
    : "form-message success";
}


// =====================================
// ADMIN LOGIN
// =====================================

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

  const email = document.getElementById("email").value.trim();
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

  loadAdminAnnouncements();
  loadStudyNotes();
}

async function handleLogout() {
  await window.supabaseClient.auth.signOut();
  location.reload();
}


// =====================================
// STUDY NOTES - SAVE / UPDATE
// =====================================

async function saveStudyNote(event) {
  event.preventDefault();

  const id = document.getElementById("studyNoteId").value;
  const title = document.getElementById("noteTitle").value.trim();
  const category = document.getElementById("noteCategory").value.trim();

  const description =
    document.getElementById("noteDescription").value.trim();

  const body =
    document.getElementById("noteBody").value.trim();

  const published =
    document.getElementById("notePublished").value === "true";

  const pdfInput = document.getElementById("notePdf");
  const pdf = pdfInput.files[0];

  if (!title || !category) {
    showMessage(
      "studyNoteMessage",
      "Please enter notes title and category.",
      true
    );
    return;
  }

  if (!body && !pdf && !id) {
    showMessage(
      "studyNoteMessage",
      "Please write notes or upload a PDF.",
      true
    );
    return;
  }

  if (pdf) {
    const isPdf =
      pdf.type === "application/pdf" ||
      pdf.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      showMessage(
        "studyNoteMessage",
        "Only PDF files are allowed.",
        true
      );
      return;
    }

    if (pdf.size > 10 * 1024 * 1024) {
      showMessage(
        "studyNoteMessage",
        "PDF size must be 10 MB or less.",
        true
      );
      return;
    }
  }

  const saveButton = document.getElementById("saveNoteButton");
  saveButton.disabled = true;

  try {
    showMessage("studyNoteMessage", "Saving study notes...");

    let fileUrl = null;

    // Preserve the previous PDF URL when editing.
    if (id) {
      const { data: oldNote, error: oldError } =
        await window.supabaseClient
          .from("study_materials")
          .select("file_url")
          .eq("id", id)
          .single();

      if (oldError) throw oldError;

      fileUrl = oldNote.file_url;
    }

    // Upload a new PDF if selected.
    if (pdf) {
      const safeName = pdf.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const filePath =
        "study-notes/" + crypto.randomUUID() + "-" + safeName;

      const { error: uploadError } =
        await window.supabaseClient.storage
          .from("site-media")
          .upload(filePath, pdf, {
            contentType: "application/pdf",
            upsert: false
          });

      if (uploadError) throw uploadError;

      const { data: publicData } =
        window.supabaseClient.storage
          .from("site-media")
          .getPublicUrl(filePath);

      fileUrl = publicData.publicUrl;
    }

    const noteData = {
      title: title,
      category: category,
      description: description || null,
      body: body || null,
      file_url: fileUrl,
      published: published
    };

    let result;

    if (id) {
      result = await window.supabaseClient
        .from("study_materials")
        .update(noteData)
        .eq("id", id);
    } else {
      result = await window.supabaseClient
        .from("study_materials")
        .insert([noteData]);
    }

    if (result.error) throw result.error;

    resetStudyNoteForm();

    showMessage(
      "studyNoteMessage",
      id
        ? "Study notes updated successfully!"
        : "Study notes saved successfully!"
    );

    await loadStudyNotes();

  } catch (error) {
    console.error("Study Notes Error:", error);

    showMessage(
      "studyNoteMessage",
      "Could not save notes: " + error.message,
      true
    );

  } finally {
    saveButton.disabled = false;
  }
}


// =====================================
// LOAD STUDY NOTES
// =====================================

async function loadStudyNotes() {
  const list = document.getElementById("adminStudyNotesList");

  list.textContent = "Loading study notes...";

  const { data, error } =
    await window.supabaseClient
      .from("study_materials")
      .select(
        "id, title, category, description, body, file_url, published, created_at"
      )
      .order("created_at", { ascending: false });

  if (error) {
    console.error("Load Notes Error:", error);

    list.textContent =
      "Could not load study notes: " + error.message;

    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "No study notes found.";
    return;
  }

  list.innerHTML = "";

  data.forEach(note => {
    const card = document.createElement("div");
    card.className = "admin-announcement";

    const heading = document.createElement("h3");
    heading.textContent = note.title;

    const category = document.createElement("p");
    category.textContent =
      "Category: " + (note.category || "General");

    const status = document.createElement("p");
    status.textContent =
      note.published ? "Status: Published" : "Status: Draft";

    status.className = "muted";

    const description = document.createElement("p");
    description.textContent = note.description || "";

    const buttons = document.createElement("div");
    buttons.className = "admin-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-outline-dark";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      editStudyNote(note);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-outline-dark";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      deleteStudyNote(note.id);
    });

    buttons.append(editButton, deleteButton);

    card.append(heading, category, status, description);

    if (note.file_url) {
      const pdfLink = document.createElement("a");

      pdfLink.href = note.file_url;
      pdfLink.target = "_blank";
      pdfLink.rel = "noopener noreferrer";
      pdfLink.textContent = "Open PDF";

      card.appendChild(pdfLink);
    }

    card.appendChild(buttons);
    list.appendChild(card);
  });
}


// =====================================
// EDIT STUDY NOTES
// =====================================

function editStudyNote(note) {
  document.getElementById("studyNoteId").value = note.id;

  document.getElementById("noteTitle").value =
    note.title || "";

  document.getElementById("noteCategory").value =
    note.category || "";

  document.getElementById("noteDescription").value =
    note.description || "";

  document.getElementById("noteBody").value =
    note.body || "";

  document.getElementById("notePublished").value =
    String(note.published);

  document.getElementById("notePdf").value = "";

  document.getElementById("saveNoteButton").textContent =
    "Update Study Notes";

  showMessage(
    "studyNoteMessage",
    "Editing: " + note.title
  );

  document.getElementById("studyNotesManager")
    .scrollIntoView({ behavior: "smooth" });
}


// =====================================
// DELETE STUDY NOTES
// =====================================

async function deleteStudyNote(id) {
  const confirmed = confirm(
    "Are you sure you want to delete these study notes?"
  );

  if (!confirmed) return;

  showMessage("studyNoteMessage", "Deleting study notes...");

  const { error } = await window.supabaseClient
    .from("study_materials")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete Notes Error:", error);

    showMessage(
      "studyNoteMessage",
      "Could not delete notes: " + error.message,
      true
    );

    return;
  }

  showMessage(
    "studyNoteMessage",
    "Study notes deleted successfully!"
  );

  await loadStudyNotes();
}


// =====================================
// RESET STUDY NOTES FORM
// =====================================

function resetStudyNoteForm() {
  const form = document.getElementById("studyNotesForm");

  form.reset();

  document.getElementById("studyNoteId").value = "";

  document.getElementById("saveNoteButton").textContent =
    "Save Study Notes";

  document.getElementById("notePublished").value = "false";
}


// =====================================
// ANNOUNCEMENTS - EXISTING CODE
// =====================================

async function publishAnnouncement(event) {
  event.preventDefault();

  const title =
    document.getElementById("announcementTitle").value.trim();

  const content =
    document.getElementById("announcementContent").value.trim();

  if (!title || !content) {
    showMessage(
      "announcementMessage",
      "Please complete both fields.",
      true
    );
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

    showMessage(
      "announcementMessage",
      "Could not publish. Check your database columns and admin permissions.",
      true
    );

    return;
  }

  document.getElementById("announcementForm").reset();

  showMessage(
    "announcementMessage",
    "Announcement published successfully!"
  );

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
    list.textContent =
      "Could not load announcements. Check admin read permissions.";

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
