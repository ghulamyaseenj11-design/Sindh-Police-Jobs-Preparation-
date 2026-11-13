
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const loginSection = document.getElementById("loginSection");
  const dashboardSection = document.getElementById("dashboardSection");
  const loginMessage = document.getElementById("loginMessage");
  const logoutButton = document.getElementById("logoutButton");

  const supabase = window.supabaseClient;

  function showMessage(message, isError = true) {
    if (!loginMessage) return;

    loginMessage.textContent = message;
    loginMessage.style.color = isError ? "#c0392b" : "#16803c";
  }

  function showLogin() {
    loginSection?.classList.remove("hidden");
    dashboardSection?.classList.add("hidden");
  }

  function showDashboard() {
    loginSection?.classList.add("hidden");
    dashboardSection?.classList.remove("hidden");
  }

  async function verifyAdmin() {
    if (!supabase) {
      showLogin();
      showMessage("Database connection unavailable.");
      return false;
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      showLogin();
      return false;
    }

    const { data, error } = await supabase.rpc("is_admin");

    if (error) {
      console.error("Admin verification error:", error);
      await supabase.auth.signOut();
      showLogin();
      showMessage("Admin verification failed. Please contact support.");
      return false;
    }

    const isAdmin =
      data === true ||
      data?.is_admin === true ||
      (Array.isArray(data) && data.some(row =>
        row?.is_admin === true
      ));

    if (!isAdmin) {
      await supabase.auth.signOut();
      showLogin();
      showMessage("Access denied. This account is not an admin.");
      return false;
    }

    showDashboard();
    return true;
  }

  // LOGIN
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!supabase) {
        showMessage("Supabase connection is not available.");
        return;
      }

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const button = loginForm.querySelector('button[type="submit"]');

      if (!email || !password) {
        showMessage("Please enter your email and password.");
        return;
      }

      button.disabled = true;
      button.textContent = "Checking...";
      showMessage("Please wait...", false);

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          showMessage(error.message);
          return;
        }

        const verified = await verifyAdmin();

        if (verified) {
          loginForm.reset();
        }

      } catch (error) {
        console.error("Login error:", error);
        showMessage("Something went wrong. Please try again.");
      } finally {
        button.disabled = false;
        button.textContent = "Login";
      }
    });
  }

  // LOGOUT
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      if (!supabase) return;

      logoutButton.disabled = true;

      const { error } = await supabase.auth.signOut();

      logoutButton.disabled = false;

      if (error) {
        console.error("Logout error:", error);
        alert("Could not log out. Please try again.");
        return;
      }

      showLogin();
      loginForm?.reset();
      showMessage("You have logged out successfully.", false);
    });
  }

  // CHECK EXISTING SESSION
  showLogin();

  verifyAdmin().catch(error => {
    console.error("Session verification error:", error);
    showLogin();
  });
});
