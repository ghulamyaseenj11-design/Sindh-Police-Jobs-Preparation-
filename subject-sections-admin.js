// Subject Sections: manage the Subject Wise sections on the Papers page
// (English, Mathematics, Science, GK & Current Affairs, Computer).
// Sections are site_settings rows: key subject_section_<key>,
// value JSON {title, icon, sort, photo}. The 5 subjects are fixed —
// the key cannot change (it is tied to the Papers page matching rule),
// so this manager only edits title, icon, order and thumbnail photo.
// Uses the admin.js globals
// ($, db, value, showMessage, setButtonLoading, resetForm, reportError,
// uploadFile). Mirrors test-sections-admin.js.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("subjectSectionForm");
  if (form) form.addEventListener("submit", event => event.preventDefault());

  document.getElementById("subjectSectionForm")
    ?.addEventListener("submit", saveSubjectSection);

  document.getElementById("cancelSubjectSectionEdit")
    ?.addEventListener("click", resetSubjectSectionForm);

  loadSubjectSections();
  const dash = document.getElementById("dashboardSection");
  const maybeLoad = () => { if (dash && !dash.classList.contains("hidden")) loadSubjectSections(); };
  if (dash) new MutationObserver(maybeLoad).observe(dash, { attributes: true, attributeFilter: ["class"] });
});

function parseSubjectSectionRow(row) {
  try {
    const v = JSON.parse(row.setting_value || "{}");
    if (!v.title) return null;
    return { id: row.id, key: String(row.setting_key).replace("subject_section_", ""), title: v.title, icon: v.icon || "", photo: v.photo || "", sort: Number(v.sort) || 0 };
  } catch (e) { return null; }
}

async function loadSubjectSections() {
  const list = $("adminSubjectSectionsList");
  if (!list || !db()) return;
  const { data, error } = await db()
    .from("site_settings")
    .select("id,setting_key,setting_value")
    .like("setting_key", "subject_section_%")
    .order("setting_key", { ascending: true });
  if (error) { list.textContent = "Could not load: " + error.message; return; }
  list.replaceChildren();
  const sections = (data || []).map(parseSubjectSectionRow).filter(Boolean)
    .sort((a, b) => a.sort - b.sort || (a.title < b.title ? -1 : 1));
  if (!sections.length) { list.textContent = "No sections yet."; return; }
  sections.forEach(s => {
    const card = document.createElement("div");
    card.className = "admin-announcement";
    const lines = [s.icon + " " + s.title, "Key: " + s.key, "Order: " + s.sort, s.photo ? "Thumbnail: set" : "Thumbnail: not set"];
    lines.forEach(t => {
      const p = document.createElement("p");
      p.textContent = t;
      card.appendChild(p);
    });
    if (s.photo) {
      const img = document.createElement("img");
      img.src = s.photo;
      img.alt = "";
      img.style.maxWidth = "220px";
      img.style.borderRadius = "10px";
      card.appendChild(img);
    }
    const row = document.createElement("div");
    row.className = "admin-actions";
    const eb = document.createElement("button");
    eb.type = "button"; eb.className = "btn btn-outline-dark"; eb.textContent = "Edit";
    eb.addEventListener("click", () => editSubjectSection(s));
    row.append(eb);
    card.appendChild(row);
    list.appendChild(card);
  });
}

function resetSubjectSectionForm() {
  $("subjectSectionForm").reset();
  $("subjectSectionKey").value = "";
  $("subjectSectionPhotoUrl").value = "";
  $("subjectSectionPhotoPreview").replaceChildren();
  $("saveSubjectSectionButton").textContent = "Save Section";
}

function editSubjectSection(s) {
  $("subjectSectionKey").value = "subject_section_" + s.key;
  $("subjectSectionSlug").value = s.key;
  $("subjectSectionTitle").value = s.title;
  $("subjectSectionIcon").value = s.icon;
  $("subjectSectionPhotoUrl").value = s.photo || "";
  const prev = $("subjectSectionPhotoPreview");
  prev.replaceChildren();
  if (s.photo) {
    const img = document.createElement("img");
    img.src = s.photo;
    img.alt = "";
    img.style.maxWidth = "220px";
    img.style.borderRadius = "10px";
    prev.appendChild(img);
  }
  $("subjectSectionOrder").value = s.sort;
  $("saveSubjectSectionButton").textContent = "Update Section";
  $("subjectSectionsManager").scrollIntoView({ behavior: "smooth" });
}

async function saveSubjectSection(event) {
  event.preventDefault();
  const key = value("subjectSectionKey");
  const title = value("subjectSectionTitle");
  const icon = value("subjectSectionIcon") || "📝";
  const sort = Number(value("subjectSectionOrder")) || 0;
  if (!key) return showMessage("subjectSectionMessage", "Pick a section to edit first (tap Edit).", true);
  if (!title) return showMessage("subjectSectionMessage", "Enter a section title.", true);

  setButtonLoading("subjectSectionForm", true, "Saving...");
  showMessage("subjectSectionMessage", "Saving...", false);
  try {
    let photo = value("subjectSectionPhotoUrl");
    const file = $("subjectSectionPhoto").files[0];
    if (file) {
      if (!file.type.startsWith("image/")) throw new Error("Photo must be an image.");
      photo = await uploadFile(file, "sections"); // existing helper in admin.js
    }
    const setting_value = JSON.stringify({ title, icon, sort, photo: photo || undefined });
    let error;
    ({ error } = await db().from("site_settings").update({ setting_value }).eq("setting_key", key));
    if (error) throw error;
    resetSubjectSectionForm();
    showMessage("subjectSectionMessage", "Section saved successfully!");
    await loadSubjectSections();
  } catch (e) {
    reportError("subjectSectionMessage", e);
  } finally {
    setButtonLoading("subjectSectionForm", false);
  }
}
