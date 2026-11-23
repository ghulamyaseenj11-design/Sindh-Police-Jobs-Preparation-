/* AI Chat settings — admin panel.
   Saves ai_enabled, ai_gemini_key and ai_daily_limit into site_settings
   (same upsert pattern as Website Settings in admin.js).
   WARNING shown in the panel too: the Gemini key is read from public
   site_settings, so use a FREE key restricted in Google Cloud Console
   to the Generative Language API only, with a low quota. Never a paid key. */
(function () {
  function $(id) { return document.getElementById(id); }
  function db() { return window.supabaseClient; }
  function value(id) { var n = $(id); return n ? n.value.trim() : ""; }

  function showMessage(text, ok) {
    var m = $("aiChatMessage");
    if (!m) return;
    m.textContent = text;
    m.style.color = ok ? "green" : "red";
  }

  async function loadAiSettings() {
    try {
      if (!db()) return;
      var res = await db().from("site_settings").select("setting_key, setting_value");
      if (res.error) throw res.error;
      (res.data || []).forEach(function (row) {
        if (row.setting_key === "ai_enabled" && $("aiEnabled")) {
          $("aiEnabled").checked = String(row.setting_value).toLowerCase() !== "false";
        }
        if (row.setting_key === "ai_gemini_key" && $("aiGeminiKey")) {
          $("aiGeminiKey").value = row.setting_value || "";
        }
        if (row.setting_key === "ai_daily_limit" && $("aiDailyLimit")) {
          $("aiDailyLimit").value = row.setting_value || "10";
        }
      });
    } catch (e) {
      showMessage("AI settings load nahi hui: " + (e && e.message ? e.message : e), false);
    }
  }

  async function saveAiSettings(event) {
    if (event) event.preventDefault();
    var btn = $("aiChatSaveBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
    try {
      if (!db()) throw new Error("Supabase connected nahi hai.");
      var limit = parseInt(value("aiDailyLimit"), 10);
      if (isNaN(limit) || limit < 1) limit = 10;
      var rows = [
        { setting_key: "ai_enabled", setting_value: $("aiEnabled") && $("aiEnabled").checked ? "true" : "false" },
        { setting_key: "ai_gemini_key", setting_value: value("aiGeminiKey") },
        { setting_key: "ai_daily_limit", setting_value: String(limit) }
      ];
      var res = await db().from("site_settings").upsert(rows, { onConflict: "setting_key" });
      if (res.error) throw res.error;
      showMessage("AI Chat settings saved!", true);
    } catch (e) {
      showMessage("Save nahi hua: " + (e && e.message ? e.message : e), false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Save AI Chat Settings"; }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("aiChatForm");
    if (form) form.addEventListener("submit", saveAiSettings);
    var tab = document.querySelector('[data-target="aiChatManager"]');
    if (tab) tab.addEventListener("click", loadAiSettings);
    loadAiSettings();
  });
})();
