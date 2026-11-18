// Manage Mock Tests - loaded AFTER admin.js. Uses the same Supabase client, login and helpers.
(function () {
  const $ = id => document.getElementById(id);
  const sb = () => window.supabaseClient;
  const MSG = "mockTestMessage";

  function msg(text, isError) {
    const el = $(MSG);
    if (!el) return;
    el.textContent = text;
    el.className = isError ? "form-message error" : "form-message success";
  }

  function toggleFields() {
    const isHtml = $("mockType").value === "html";
    $("mockLinkFields").classList.toggle("hidden", isHtml);
    $("mockHtmlFields").classList.toggle("hidden", !isHtml);
    $("mockUrl").required = !isHtml;
    $("mockHtml").required = isHtml;
  }

  function resetForm() {
    $("mockTestForm").reset();
    $("mockTestId").value = "";
    $("saveMockButton").textContent = "Save Mock Test";
    toggleFields();
  }

  async function loadSections() {
    const sel = $("mockSection");
    if (!sel || !sb()) return;
    const { data, error } = await sb()
      .from("site_settings")
      .select("setting_key,setting_value")
      .like("setting_key", "mock_section_%");
    if (error || !data) return;
    const sections = data.map(row => {
      try {
        const v = JSON.parse(row.setting_value || "{}");
        return { slug: row.setting_key.replace("mock_section_", ""), title: v.title || "", sort: Number(v.sort) || 0 };
      } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => a.sort - b.sort || (a.title < b.title ? -1 : 1));
    window.__mockTestSections = sections;
    sel.replaceChildren();
    sections.forEach(s => {
      const o = document.createElement("option");
      o.value = s.slug;
      o.textContent = s.title;
      sel.appendChild(o);
    });
  }

  async function saveAssignment(testId, slug) {
    if (!slug) return;
    const key = "mock_test_section_" + testId;
    const { data: existing } = await sb().from("site_settings").select("id").eq("setting_key", key).maybeSingle();
    if (existing) {
      const { error } = await sb().from("site_settings").update({ setting_value: slug }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb().from("site_settings").insert([{ setting_key: key, setting_value: slug }]);
      if (error) throw error;
    }
  }

  async function save(event) {
    event.preventDefault();
    const id = $("mockTestId").value;
    const type = $("mockType").value;
    const title = $("mockTitle").value.trim();
    const url = $("mockUrl").value.trim();
    const html = $("mockHtml").value;

    if (!title) return msg("Title is required.", true);
    if (type === "link" && !/^https?:\/\//i.test(url)) return msg("Enter a valid link starting with http:// or https://", true);
    if (type === "html" && !html.trim()) return msg("Paste the HTML code of the test.", true);

    const btn = $("saveMockButton");
    btn.disabled = true;
    msg("Saving...", false);
    try {
      const payload = {
        title,
        description: $("mockDescription").value.trim(),
        test_type: type,
        test_url: type === "link" ? url : null,
        html_content: type === "html" ? html : null,
        published: $("mockPublished").value === "true",
        sort_order: Number($("mockOrder").value) || 0
      };
      const file = $("mockThumb").files[0];
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Thumbnail must be an image.");
        payload.thumbnail_url = await uploadFile(file, "mock-tests"); // existing helper in admin.js
      }
      const q = id
        ? sb().from("mock_tests").update(payload).eq("id", id).select("id")
        : sb().from("mock_tests").insert([payload]).select("id");
      const { data: saved, error } = await q;
      if (error) throw error;
      const testId = id || (saved && saved[0] && saved[0].id);
      let assignWarn = null;
      if (testId) {
        try { await saveAssignment(testId, $("mockSection").value); }
        catch (e) { console.error(e); assignWarn = "Test saved, but the section could not be saved."; }
      }
      resetForm();
      msg(assignWarn || "Mock test saved successfully!", !!assignWarn);
      await load();
    } catch (e) {
      console.error(e);
      msg(e.message || "Could not save.", true);
    } finally {
      btn.disabled = false;
    }
  }

  async function edit(item) {
    // html_content is fetched only when editing, to keep the list light
    const { data, error } = await sb().from("mock_tests").select("*").eq("id", item.id).single();
    if (error) return msg(error.message, true);
    $("mockTestId").value = data.id;
    $("mockType").value = data.test_type;
    $("mockTitle").value = data.title || "";
    $("mockDescription").value = data.description || "";
    $("mockUrl").value = data.test_url || "";
    $("mockHtml").value = data.html_content || "";
    $("mockPublished").value = String(!!data.published);
    $("mockOrder").value = data.sort_order ?? 0;
    if (!$("mockSection").options.length) await loadSections();
    const { data: assign } = await sb().from("site_settings").select("setting_value").eq("setting_key", "mock_test_section_" + data.id).maybeSingle();
    if (assign && assign.setting_value) $("mockSection").value = assign.setting_value;
    $("saveMockButton").textContent = "Update Mock Test";
    toggleFields();
    $("mockTestsManager").scrollIntoView({ behavior: "smooth" });
  }

  async function togglePublish(item) {
    const { error } = await sb().from("mock_tests").update({ published: !item.published }).eq("id", item.id);
    if (error) return msg(error.message, true);
    msg(item.published ? "Unpublished." : "Published.", false);
    load();
  }

  async function remove(item) {
    if (!confirm("Delete this mock test permanently?")) return;
    const { error } = await sb().from("mock_tests").delete().eq("id", item.id);
    if (error) return msg(error.message, true);
    msg("Deleted successfully!", false);
    load();
  }

  function button(label, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-outline-dark";
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }

  async function load() {
    const list = $("adminMockTestsList");
    if (!list || !sb()) return;
    const sections = window.__mockTestSections || [];
    const bySlug = {};
    sections.forEach(s => { bySlug[s.slug] = s.title; });
    const { data: assigns } = await sb().from("site_settings").select("setting_key,setting_value").like("setting_key", "mock_test_section_%");
    const assignMap = {};
    (assigns || []).forEach(r => { assignMap[r.setting_key.replace("mock_test_section_", "")] = r.setting_value; });
    const firstSlug = sections.length ? sections[0].slug : null;
    const { data, error } = await sb()
      .from("mock_tests")
      .select("id,title,description,test_type,test_url,published,sort_order,created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) { list.textContent = "Could not load: " + error.message; return; }
    list.replaceChildren();
    if (!data.length) { list.textContent = "No mock tests yet."; return; }
    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "admin-announcement";
      [item.title,
       item.test_type === "html" ? "HTML Test" : "External Link: " + (item.test_url || ""),
       "Section: " + (bySlug[assignMap[item.id] || firstSlug] || "—"),
       item.published ? "Published" : "Draft",
       "Order: " + item.sort_order].forEach(t => {
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
    const form = $("mockTestForm");
    if (!form) return;
    form.addEventListener("submit", save);
    $("mockType").addEventListener("change", toggleFields);
    $("cancelMockEdit").addEventListener("click", resetForm);
    toggleFields();

    // Load the list whenever the dashboard becomes visible (i.e. after a successful admin login).
    const dash = $("dashboardSection");
    const maybeLoad = () => { if (!dash.classList.contains("hidden")) { loadSections(); load(); } };
    new MutationObserver(maybeLoad).observe(dash, { attributes: true, attributeFilter: ["class"] });
    maybeLoad();
  });
})();
