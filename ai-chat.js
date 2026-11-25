/* AI Helper chat — Study with GYJ (homepage only)
   Floating notification-style button, bottom-right above the bottom bar.
   Answers exam-preparation questions with Google Gemini.
   Settings come from site_settings: ai_enabled, ai_gemini_key, ai_daily_limit.
   Daily limit is counted per logged-in user in the ai_usage table
   (falls back to this device only if that table is not made yet).
   NOTE: the Gemini key is read from public site_settings, so anyone who
   looks at the page can see it. Use a FREE key, restricted in Google
   Cloud Console to the Generative Language API only, with a low quota.
   Never put a paid key here. */
(function () {
  "use strict";

  var DEFAULT_LIMIT = 0; /* 0 = unlimited, koi limit nahi */
  var GEMINI_MODEL = "gemini-3.8-flash"; /* Google ne 2.0-flash band kar diya, 3.8-flash naya hai */
  var SYS = "You are a short, plain exam-preparation helper for Pakistani government job tests (Sindh Jail Police, Vaccinators, Islamabad Police, PST JST, PAA, FIA). Answer briefly in the same language as the question (Urdu, English or Sindhi). Keep answers short and simple, like a teacher. If you are not sure, say so honestly instead of guessing. Never invent exam dates, results or official notices.";

  var settings = { enabled: true, key: "", limit: DEFAULT_LIMIT, model: GEMINI_MODEL };
  var userId = null;
  var usedToday = 0;
  var tableReady = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  /* PKT date (UTC+5, no daylight saving) as YYYY-MM-DD */
  function pktToday() {
    return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function pktMidnightISO() {
    return pktToday() + "T00:00:00+05:00";
  }
  function client() { return window.supabaseClient || null; }

  /* ---------- styles ---------- */
  var css = [
    "#aiChatBtn{position:fixed;right:16px;bottom:84px;z-index:1001;width:56px;height:56px;border-radius:50%;border:none;background:#0B2341;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 8px 22px rgba(11,35,65,.4);display:grid;place-items:center}",
    "#aiChatBtn .ai-badge{position:absolute;top:-4px;right:-4px;background:#C9A227;color:#0B2341;font-size:10px;font-weight:800;border-radius:999px;padding:2px 6px;border:2px solid #fff}",
    "#aiChatPanel{position:fixed;right:16px;bottom:150px;z-index:1002;width:min(360px,calc(100vw - 32px));height:min(520px,72vh);background:#fff;border:1px solid rgba(11,35,65,.15);border-radius:18px;box-shadow:0 18px 44px rgba(11,35,65,.35);display:none;flex-direction:column;overflow:hidden;font-family:inherit}",
    "#aiChatPanel.open{display:flex}",
    ".ai-head{background:#0B2341;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}",
    ".ai-head b{font-size:1rem}",
    ".ai-head small{display:block;font-weight:400;opacity:.8;font-size:.78rem}",
    ".ai-head .ai-x{margin-left:auto;background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer}",
    "#aiChatLog{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#F2F5F9}",
    ".ai-msg{max-width:88%;padding:9px 12px;border-radius:14px;font-size:.92rem;line-height:1.5;white-space:pre-wrap;word-break:break-word}",
    ".ai-msg.user{align-self:flex-end;background:#0B2341;color:#fff;border-bottom-right-radius:4px}",
    ".ai-msg.bot{align-self:flex-start;background:#fff;border:1px solid rgba(11,35,65,.12);color:#0f1b33;border-bottom-left-radius:4px}",
    ".ai-msg.sys{align-self:center;background:transparent;color:#5b6b82;font-size:.82rem;text-align:center}",
    ".ai-typing{font-style:italic;color:#5b6b82}",
    ".ai-foot{border-top:1px solid rgba(11,35,65,.12);padding:10px;display:flex;gap:8px}",
    "#aiChatInput{flex:1;padding:10px 12px;border:2px solid #0B2341;border-radius:999px;outline:none;font:inherit;font-size:.95rem}",
    "#aiChatSend{flex:none;padding:10px 16px;border:none;border-radius:999px;background:#C9A227;color:#0B2341;font-weight:800;cursor:pointer}",
    "#aiChatSend:disabled{opacity:.5;cursor:default}",
    ".ai-limit{padding:6px 12px;font-size:.78rem;color:#5b6b82;background:#fff;border-top:1px solid rgba(11,35,65,.08);text-align:center}",
    "[data-theme=\"dark\"] #aiChatPanel{background:#14243f;border-color:rgba(255,255,255,.12)}",
    "[data-theme=\"dark\"] #aiChatLog{background:#0b1426}",
    "[data-theme=\"dark\"] .ai-msg.bot{background:#1c2f52;color:#e8eefc;border-color:rgba(255,255,255,.1)}",
    "[data-theme=\"dark\"] .ai-foot,[data-theme=\"dark\"] .ai-limit{background:#14243f;color:#9fb0cf}",
    "[data-theme=\"dark\"] #aiChatInput{background:#0b1426;color:#e8eefc;border-color:#C9A227}"
  ].join("\n");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- DOM ---------- */
  var btn = el("button", null, "💬");
  btn.id = "aiChatBtn";
  btn.setAttribute("aria-label", "AI Helper se sawal poochho");
  btn.title = "AI Helper";
  btn.appendChild(el("span", "ai-badge", "AI"));

  var panel = el("div", null, null);
  panel.id = "aiChatPanel";
  var head = el("div", "ai-head", null);
  head.appendChild(el("span", null, "🤖"));
  var ht = el("div", null, null);
  ht.appendChild(el("b", null, "AI Helper"));
  ht.appendChild(el("small", null, "Sawal poochho — exam ki tayyari"));
  head.appendChild(ht);
  var x = el("button", "ai-x", "✕");
  x.setAttribute("aria-label", "Band karo");
  head.appendChild(x);
  var log = el("div", null, null);
  log.id = "aiChatLog";
  var foot = el("div", "ai-foot", null);
  var input = el("input", null, null);
  input.id = "aiChatInput";
  input.type = "text";
  input.placeholder = "Apna sawal likho...";
  input.setAttribute("autocomplete", "off");
  var send = el("button", null, "Bhejo");
  send.id = "aiChatSend";
  foot.appendChild(input);
  foot.appendChild(send);
  var limitLine = el("div", "ai-limit", "");
  limitLine.id = "aiChatLimit";
  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(foot);
  panel.appendChild(limitLine);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  function addMsg(text, who) {
    var m = el("div", "ai-msg " + who, null);
    m.innerHTML = esc(text).replace(/\n/g, "<br>");
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }
  function setLimitLine() {
    if (settings.limit === 0) {
      limitLine.textContent = "Unlimited jawab — jitne marzi sawal poochho";
      return;
    }
    var left = Math.max(0, settings.limit - usedToday);
    limitLine.textContent = "Aaj ke " + left + " / " + settings.limit + " jawab baqi hain";
  }

  /* ---------- settings + login + limit ---------- */
  function loadSettings() {
    var sb = client();
    if (!sb) return Promise.resolve();
    return sb.from("site_settings").select("setting_key, setting_value").then(function (r) {
      (r.data || []).forEach(function (row) {
        if (row.setting_key === "ai_enabled") settings.enabled = String(row.setting_value).toLowerCase() !== "false";
        if (row.setting_key === "ai_gemini_key") settings.key = (row.setting_value || "").trim();
        if (row.setting_key === "ai_daily_limit") {
          var n = parseInt(row.setting_value, 10);
          if (!isNaN(n) && n >= 0) settings.limit = n;
        }
        if (row.setting_key === "ai_model") {
          var m = (row.setting_value || "").trim();
          if (m) settings.model = m;
        }
      });
    }).catch(function () {});
  }

  function loadUsage() {
    var sb = client();
    if (!sb) return Promise.resolve();
    return sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s || !s.user) { userId = null; return; }
      userId = s.user.id;
      return sb.from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", pktMidnightISO())
        .then(function (res) {
          if (res.error) throw res.error;
          tableReady = true;
          usedToday = res.count || 0;
        });
    }).catch(function () {
      /* table not made yet — count on this device only */
      tableReady = false;
      try { usedToday = parseInt(localStorage.getItem("sjp_ai_used_" + pktToday()) || "0", 10) || 0; } catch (e) { usedToday = 0; }
    });
  }

  function markUsed() {
    usedToday++;
    if (!tableReady) {
      try { localStorage.setItem("sjp_ai_used_" + pktToday(), String(usedToday)); } catch (e) {}
      return Promise.resolve();
    }
    var sb = client();
    if (!sb || !userId) return Promise.resolve();
    return sb.from("ai_usage").insert({ user_id: userId }).then(function () {}).catch(function () {});
  }

  /* ---------- ask Gemini ---------- */
  /* Google free tier par 3.8-flash kabhi kabhi "high demand / overloaded"
     (503) kehta hai — ye aam tor par chand minute ka hota hai. Is liye
     overload par khud 3 dafa dobara try karo, har dafa thora zyada wait
     kar ke, phir bhi na ho to saaf batao. */
  function callGeminiOnce(q) {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(settings.model) +
      ":generateContent?key=" + encodeURIComponent(settings.key);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: [{ parts: [{ text: q }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error && data.error.message) || ("Error " + res.status));
          err.status = res.status;
          throw err;
        }
        var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        var text = parts && parts.map(function (p) { return p.text || ""; }).join("").trim();
        if (!text) throw new Error("Koi jawab nahi mila.");
        return text;
      });
    });
  }

  function askGemini(q) {
    var attempt = 0;
    function tryOnce() {
      attempt++;
      return callGeminiOnce(q).catch(function (err) {
        var msg = String((err && err.message) || "");
        var overloaded = err.status === 503 || err.status === 429 ||
          /overload|high demand|temporar|unavailable|rate limit/i.test(msg);
        if (overloaded && attempt < 3) {
          return new Promise(function (resolve) { setTimeout(resolve, attempt * 4000); }).then(tryOnce);
        }
        throw err;
      });
    }
    return tryOnce();
  }

  function sendQuestion() {
    var q = input.value.trim();
    if (!q) return;
    if (!settings.enabled) { addMsg("AI Helper abhi band hai.", "sys"); return; }
    if (!settings.key) { addMsg("AI key abhi nahi lagi hai. Admin se rabta karo.", "sys"); return; }
    if (!userId) {
      addMsg("Pehle login karo, phir sawal poochh sakte ho.", "sys");
      window.location.href = "auth.html";
      return;
    }
    if (settings.limit > 0 && usedToday >= settings.limit) {
      addMsg("Aaj ki limit (" + settings.limit + " jawab) khatam ho gayi hai. Kal phir poochhna.", "sys");
      return;
    }
    addMsg(q, "user");
    input.value = "";
    send.disabled = true;
    var typing = addMsg("Soch raha hun...", "bot");
    typing.classList.add("ai-typing");
    askGemini(q).then(function (answer) {
      typing.remove();
      addMsg(answer, "bot");
      return markUsed();
    }).then(function () {
      setLimitLine();
    }).catch(function (err) {
      typing.remove();
      var msg = (err && err.message) ? err.message : "error";
      if (/overload|high demand|temporar|unavailable/i.test(msg)) {
        addMsg("Google ke server abhi busy hain, is liye jawab nahi mila. Thori der baad dobara poochho, aksar chand minute mein theek ho jata hai.", "sys");
      } else {
        addMsg("Maaf karo, jawab nahi mila: " + msg, "sys");
      }
    }).finally(function () {
      send.disabled = false;
      input.focus();
    });
  }

  /* ---------- wire up ---------- */
  btn.addEventListener("click", function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      if (!log.children.length) {
        addMsg("Assalam o Alaikum! Main AI Helper hun. Exam ki tayyari ke bare mein koi bhi sawal poochho — jaise Biology kya hai, ya MS Excel ka kya kaam hai.", "bot");
      }
      setLimitLine();
      input.focus();
    }
  });
  x.addEventListener("click", function () { panel.classList.remove("open"); });
  send.addEventListener("click", sendQuestion);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendQuestion(); });

  loadSettings().then(loadUsage).then(setLimitLine);
})();
