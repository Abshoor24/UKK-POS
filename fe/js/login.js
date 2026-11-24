const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-btn");
const loginAlert = document.getElementById("login-alert");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAlert(loginAlert, "");

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setAlert(loginAlert, "Username dan password wajib diisi.");
    return;
  }

  setButtonLoading(loginButton, true, "Memproses...");

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { username, password },
    });

    if (!data || !data.token || !data.user) {
      throw new Error("Respons login dari server tidak lengkap.");
    }

    setSession(data.token, data.user);
    goToDashboard();
  } catch (error) {
    setAlert(loginAlert, error.message || "Login gagal.");
  } finally {
    setButtonLoading(loginButton, false);
  }
});
