// Test Sections: manage the exam sections on the Mock Tests page
// (Jail Police, Vaccinators, Islamabad Police, PST JST, ...).
// Sections are site_settings rows: key mock_section_<slug>,
// value JSON {title, icon, sort}. Uses the admin.js globals
// ($, db, value, showMessage, setButtonLoading, resetForm, reportError).
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("testSectionForm");
  if (form) form.addEventListener("submit", event => event.preventDefault());

  document.getElementById("testSectionForm")
    ?.addEventListener("submit", saveSection);

  document.getElementById("cancelSectionEdit")
    ?.addEventListener("click", resetSectionForm);

  loadSections();
  const dash = document.getElementById("dashboardSection");
  const maybeLoad = () => { if (dash && !dash.classList.contains("hidden")) loadSections(); };
  if (dash) new MutationObserver(maybeLoad).observe(dash, { attributes: true, attributeFilter: ["class"] });
});

function slugify(s) {
  return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseSectionRow(row) {
  try {
    const v = JSON.parse(row.setting_value || "{}");
    if (!v.title) return null;
    return { id: row.id, slug: String(row.setting_key).replace("mock_section_", ""), title: v.title, icon: v.icon || "", photo: v.photo || "", sort: Number(v.sort) || 0 };
  } catch (e) { return null; }
}

async function loadSections() {
  const list = $("adminTestSectionsList");
  if (!list || !db()) return;
  const { data, error } = await db()
    .from("site_settings")
    .select("id,setting_key,setting_value")
    .like("setting_key", "mock_section_%")
    .order("setting_key", { ascending: true });
  if (error) { list.textContent = "Could not load: " + error.message; return; }
  list.replaceChildren();
  const sections = (data || []).map(parseSectionRow).filter(Boolean)
    .sort((a, b) => a.sort - b.sort || (a.title < b.title ? -1 : 1));
  if (!sections.length) { list.textContent = "No sections yet."; return; }
  sections.forEach(s => {
    const card = document.createElement("div");
    card.className = "admin-announcement";
    [s.icon + " " + s.title, "Slug: " + s.slug, "Order: " + s.sort].forEach(t => {
      const p = document.createElement("p");
      p.textContent = t;
      card.appendChild(p);
    });
    const row = document.createElement("div");
    row.className = "admin-actions";
    const eb = document.createElement("button");
    eb.type = "button"; eb.className = "btn btn-outline-dark"; eb.textContent = "Edit";
    eb.addEventListener("click", () => editSection(s));
    const dbtn = document.createElement("button");
    dbtn.type = "button"; dbtn.className = "btn btn-outline-dark"; dbtn.textContent = "Delete";
    dbtn.addEventListener("click", () => deleteSection(s));
    row.append(eb, dbtn);
    card.appendChild(row);
    list.appendChild(card);
  });
}

function resetSectionForm() {
  $("testSectionForm").reset();
  $("testSectionKey").value = "";
  $("testSectionPhotoUrl").value = "";
  $("testSectionPhotoPreview").replaceChildren();
  $("testSectionSlug").disabled = false;
  $("saveSectionButton").textContent = "Save Section";
}

function editSection(s) {
  $("testSectionKey").value = "mock_section_" + s.slug;
  $("testSectionSlug").value = s.slug;
  $("testSectionSlug").disabled = true;
  $("testSectionTitle").value = s.title;
  $("testSectionIcon").value = s.icon;
  $("testSectionPhotoUrl").value = s.photo || "";
  const prev = $("testSectionPhotoPreview");
  prev.replaceChildren();
  if (s.photo) {
    const img = document.createElement("img");
    img.src = s.photo;
    img.alt = "";
    img.style.maxWidth = "220px";
    img.style.borderRadius = "10px";
    prev.appendChild(img);
  }
  $("testSectionOrder").value = s.sort;
  $("saveSectionButton").textContent = "Update Section";
  $("testSectionsManager").scrollIntoView({ behavior: "smooth" });
}

async function deleteSection(s) {
  if (!confirm("Delete the '" + s.title + "' section? Its tests will move to the first section.")) return;
  const { error } = await db().from("site_settings").delete().eq("id", s.id);
  if (error) return showMessage("testSectionMessage", error.message, true);
  showMessage("testSectionMessage", "Section deleted.");
  await loadSections();
}

async function saveSection(event) {
  event.preventDefault();
  const key = value("testSectionKey");
  const slug = slugify(value("testSectionSlug"));
  const title = value("testSectionTitle");
  const icon = value("testSectionIcon") || "📝";
  const sort = Number(value("testSectionOrder")) || 0;
  if (!slug) return showMessage("testSectionMessage", "Enter a section slug (e.g. jail-police).", true);
  if (!title) return showMessage("testSectionMessage", "Enter a section title.", true);

  setButtonLoading("testSectionForm", true, "Saving...");
  showMessage("testSectionMessage", "Saving...", false);
  try {
    let photo = value("testSectionPhotoUrl");
    const file = $("testSectionPhoto").files[0];
    if (file) {
      if (!file.type.startsWith("image/")) throw new Error("Photo must be an image.");
      photo = await uploadFile(file, "sections"); // existing helper in admin.js
    }
    const setting_value = JSON.stringify({ title, icon, sort, photo: photo || undefined });
    let error;
    if (key) {
      ({ error } = await db().from("site_settings").update({ setting_value }).eq("setting_key", key));
    } else {
      const { data: existing } = await db().from("site_settings").select("id").eq("setting_key", "mock_section_" + slug).maybeSingle();
      if (existing) {
        ({ error } = await db().from("site_settings").update({ setting_value }).eq("id", existing.id));
      } else {
        ({ error } = await db().from("site_settings").insert([{ setting_key: "mock_section_" + slug, setting_value }]));
      }
    }
    if (error) throw error;
    resetSectionForm();
    showMessage("testSectionMessage", "Section saved successfully!");
    await loadSections();
  } catch (e) {
    reportError("testSectionMessage", e);
  } finally {
    setButtonLoading("testSectionForm", false);
  }
}
