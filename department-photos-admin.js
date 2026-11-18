// Department Photos: upload one photo per department from the admin panel.
// The photo is stored in Supabase Storage (site-media / departments) and its
// public URL is saved in site_settings as dept_thumb_<slug>. The Departments
// page reads that setting first and falls back to its built-in photo.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("deptPhotoForm");
  if (form) form.addEventListener("submit", event => event.preventDefault());

  document.getElementById("deptPhotoForm")
    ?.addEventListener("submit", saveDeptPhoto);

  document.getElementById("deptPhotoCategory")
    ?.addEventListener("change", loadDeptPhotoPreview);

  loadDeptPhotoPreview();
});

const DEPT_PHOTO_TITLES = {
  "prison-constable-male": "Prison Constable (Male)",
  "lady-prison-constable": "Lady Prison Constable",
  "eligibility": "Eligibility",
  "physical-test": "Physical Test",
  "written-test": "Written Test",
  "interview": "Interview"
};

async function loadDeptPhotoPreview() {
  const slug = value("deptPhotoCategory");
  const box = $("deptPhotoPreview");
  if (!box) return;

  box.innerHTML = '<p class="muted">Loading...</p>';

  const { data, error } = await db()
    .from("site_settings")
    .select("setting_value")
    .eq("setting_key", "dept_thumb_" + slug)
    .maybeSingle();

  if (error) {
    box.innerHTML = '<p class="muted">Could not load the current photo.</p>';
    return;
  }

  box.innerHTML = "";

  if (data && data.setting_value) {
    const img = document.createElement("img");
    img.src = data.setting_value;
    img.alt = DEPT_PHOTO_TITLES[slug] || slug;
    img.style.cssText = "width:100%;max-width:420px;border-radius:12px;display:block";
    box.appendChild(img);
  } else {
    box.innerHTML = '<p class="muted">No photo uploaded yet for this department.</p>';
  }
}

async function saveDeptPhoto(event) {
  event.preventDefault();

  const slug = value("deptPhotoCategory");
  const file = $("deptPhotoFile").files[0];

  if (!file) {
    showMessage("deptPhotoMessage", "Please select a photo.", true);
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showMessage("deptPhotoMessage", "Please select a JPG, PNG or WebP photo.", true);
    return;
  }

  setButtonLoading("deptPhotoForm", true, "Uploading...");
  showMessage("deptPhotoMessage", "Uploading...", false);

  try {
    const url = await uploadFile(file, "departments");
    const key = "dept_thumb_" + slug;

    const { data: existing } = await db()
      .from("site_settings")
      .select("id")
      .eq("setting_key", key)
      .maybeSingle();

    const query = existing
      ? db().from("site_settings").update({ setting_value: url }).eq("id", existing.id)
      : db().from("site_settings").insert([{ setting_key: key, setting_value: url }]);

    const { error } = await query;
    if (error) throw error;

    resetForm("deptPhotoForm");
    $("deptPhotoCategory").value = slug;
    showMessage("deptPhotoMessage", "Photo uploaded successfully!");
    await loadDeptPhotoPreview();
  } catch (error) {
    reportError("deptPhotoMessage", error);
  } finally {
    setButtonLoading("deptPhotoForm", false);
  }
}
