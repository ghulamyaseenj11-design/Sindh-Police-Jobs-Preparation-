// Manage Category Pages - loaded AFTER admin.js. Uses the same Supabase client and admin login.
(function () {
  const $ = id => document.getElementById(id);
  const sb = () => window.supabaseClient;
  const TYPE = { details: "Details", tip: "Tip", trick: "Trick" };

  function msg(text, isError) {
    const el = $("catMessage");
    if (!el) return;
    el.textContent = text;
    el.className = isError ? "form-message error" : "form-message success";
  }

  function resetForm() {
    $("catForm").reset();
    $("catSectionId").value = "";
    $("saveCatButton").textContent = "Save Section";
  }

  async function save(event) {
    event.preventDefault();
    const id = $("catSectionId").value;
    const title = $("catTitle").value.trim();
    const content = $("catContent").value.trim();
    if (!title || !content) return msg("Title and content are required.", true);

    const btn = $("saveCatButton");
    btn.disabled = true;
    msg("Saving...", false);
    try {
      const payload = {
        category: $("catCategory").value,
        title,
        section_type: $("catType").value,
        content,
        sort_order: Number($("catOrder").value) || 0,
        published: $("catPublished").value === "true"
      };
      const q = id
        ? sb().from("category_sections").update(payload).eq("id", id)
        : sb().from("category_sections").insert([payload]);
      const { error } = await q;
      if (error) throw error;
      const keep = payload.category;
      resetForm();
      $("catCategory").value = keep;
      msg("Section saved successfully!", false);
      await load();
    } catch (e) {
      console.error(e);
      msg(e.message || "Could not save.", true);
    } finally {
      btn.disabled = false;
    }
  }

  function button(label, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-outline-dark";
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }

  function edit(item) {
    $("catSectionId").value = item.id;
    $("catCategory").value = item.category;
    $("catTitle").value = item.title || "";
    $("catType").value = item.section_type;
    $("catContent").value = item.content || "";
    $("catOrder").value = item.sort_order ?? 0;
    $("catPublished").value = String(!!item.published);
    $("saveCatButton").textContent = "Update Section";
    $("categoryManager").scrollIntoView({ behavior: "smooth" });
  }

  async function togglePublish(item) {
    const { error } = await sb().from("category_sections").update({ published: !item.published }).eq("id", item.id);
    if (error) return msg(error.message, true);
    load();
  }

  async function remove(item) {
    if (!confirm("Delete this section permanently?")) return;
    const { error } = await sb().from("category_sections").delete().eq("id", item.id);
    if (error) return msg(error.message, true);
    msg("Deleted successfully!", false);
    load();
  }

  async function load() {
    const list = $("adminCatList");
    if (!list || !sb()) return;
    const cat = $("catCategory").value;
    const { data, error } = await sb()
      .from("category_sections")
      .select("*")
      .eq("category", cat)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) { list.textContent = "Could not load: " + error.message; return; }
    list.replaceChildren();
    if (!data.length) { list.textContent = "No sections for this page yet."; return; }
    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "admin-announcement";
      [item.title,
       TYPE[item.section_type] + " • " + (item.published ? "Published" : "Draft") + " • Order: " + item.sort_order,
       item.content.length > 140 ? item.content.slice(0, 140) + "…" : item.content].forEach(t => {
        const p = document.createElement("p");
        p.textContent = t;
        card.appendChild(p);
      });
      const row = document.createElement("div");
      row.className = "admin-actions";
      row.append(
        button("Edit", () => edit(item)),
        button(item.published ? "Unpublish" : "Publish", () => togglePublish(item)),
        button("Delete", () => remove(item))
      );
      card.appendChild(row);
      list.appendChild(card);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = $("catForm");
    if (!form) return;
    form.addEventListener("submit", save);
    $("cancelCatEdit").addEventListener("click", () => { const c = $("catCategory").value; resetForm(); $("catCategory").value = c; });
    $("catCategory").addEventListener("change", load);

    const dash = $("dashboardSection");
    const maybeLoad = () => { if (!dash.classList.contains("hidden")) load(); };
    new MutationObserver(maybeLoad).observe(dash, { attributes: true, attributeFilter: ["class"] });
    maybeLoad();
  });
})();
