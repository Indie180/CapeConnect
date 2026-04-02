(function () {
  const THEME_KEY = "theme";
  const USER_KEY = "ccUserSnapshot";
  const LEGACY_USER_KEY = "currentUser";
  const BUS_KEY = "selectedBus";
  const AUTH_KEY = "ccAuthSession";
  const storage = window.sessionStorage;

  function readJson(key, fallback = null) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function normalizeBus(bus) {
    const value = String(bus || "").toLowerCase().trim();
    if (value === "ga" || value === "golden-arrow" || value === "goldenarrow") return "ga";
    if (value === "myciti") return "myciti";
    return "";
  }

  function uniqueBuses(list) {
    return Array.from(new Set((Array.isArray(list) ? list : []).map(normalizeBus).filter(Boolean)));
  }

  function getCurrentUser() {
    const snapshot = readJson(USER_KEY, null);
    if (snapshot) return snapshot;

    const apiSession = getApiSession();
    if (apiSession?.user) {
      const mapped = mapApiUserToFrontendUser(apiSession.user, apiSession.user.email || "");
      saveCurrentUser(mapped);
      return mapped;
    }
    return null;
  }

  function saveCurrentUser(user) {
    if (!user) return;
    writeJson(USER_KEY, user);
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(LEGACY_USER_KEY);
    } catch (_err) {
      // Ignore storage cleanup errors.
    }
  }

  function readSelectedBus() {
    const sessionBus = normalizeBus(storage.getItem(BUS_KEY));
    if (sessionBus) return sessionBus;
    const user = readJson(USER_KEY, null);
    if (user?.operator) return normalizeBus(user.operator);
    if (Array.isArray(user?.buses) && user.buses[0]) return normalizeBus(user.buses[0]);
    const apiSession = getApiSession();
    if (apiSession?.user?.operator) return normalizeBus(apiSession.user.operator);
    if (Array.isArray(apiSession?.user?.buses) && apiSession.user.buses[0]) {
      return normalizeBus(apiSession.user.buses[0]);
    }
    return "";
  }

  function persistSelectedBus(bus) {
    const normalizedBus = normalizeBus(bus);
    if (normalizedBus) {
      storage.setItem(BUS_KEY, normalizedBus);
    } else {
      storage.removeItem(BUS_KEY);
    }
  }

  function setTheme(theme) {
    const fixedTheme = "dark";
    document.documentElement.setAttribute("data-theme", fixedTheme);
    localStorage.setItem(THEME_KEY, fixedTheme);
  }

  function initializeTheme() {
    setTheme("dark");
  }

  function toggleTheme() {
    setTheme("dark");
  }

  function wireBackButtons() {
    document.querySelectorAll(".back-btn").forEach((button) => {
      button.addEventListener("click", () => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        const selectedBus = readSelectedBus();
        window.location.href = getBusHome(selectedBus || "myciti");
      });
    });
  }

  function deriveName(identity) {
    const raw = String(identity || "").trim();
    if (!raw) return "CapeConnect User";
    if (raw.includes("@")) return raw.split("@")[0];
    return raw.replace(/[^\dA-Za-z ]+/g, "").trim() || "CapeConnect User";
  }

  function saveUserSession(payload) {
    saveCurrentUser(payload);
  }

  function getApiSession() {
    if (window.CCApi && typeof window.CCApi.readAuthSession === "function") {
      return window.CCApi.readAuthSession();
    }
    return readJson(AUTH_KEY, null);
  }

  function clearLocalUserState() {
    storage.removeItem(USER_KEY);
    storage.removeItem(BUS_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    localStorage.removeItem(BUS_KEY);
  }

  function normalizeOperator(operator) {
    const value = String(operator || "").toLowerCase().trim();
    if (value === "ga" || value === "golden_arrow" || value === "golden arrow" || value === "golden-arrow") return "ga";
    if (value === "myciti") return "myciti";
    return "";
  }

  function normalizeRole(role) {
    const value = String(role || "").toLowerCase().trim();
    if (value === "operator_admin" || value === "super_admin" || value === "admin") return "admin";
    return "user";
  }

  function mapApiUserToFrontendUser(apiUser, fallbackIdentity = "") {
    const normalizedOperator = normalizeOperator(apiUser?.operator);
    const apiBuses = uniqueBuses(apiUser?.buses || apiUser?.linkedServices || []);
    const selectedBus = normalizedOperator || apiBuses[0] || "";
    return {
      id: apiUser?.id || null,
      name: apiUser?.fullName || deriveName(apiUser?.email || fallbackIdentity),
      email: apiUser?.email || "",
      phone: apiUser?.phone || "",
      role: normalizeRole(apiUser?.role),
      operator: normalizedOperator || null,
      isNew: false,
      buses: uniqueBuses([...apiBuses, ...(selectedBus ? [selectedBus] : [])]),
      bankDetails: apiUser?.bankDetails || {
        bankName: "",
        branchName: "",
        branchCode: "",
        country: "South Africa",
        accountNumber: "",
        accountType: "savings",
        currency: "ZAR",
        accountHolderConfirmed: false,
      },
      walletBalance: 0,
      savedCards: [],
      transactions: [],
    };
  }

  async function hydrateUserFromSession() {
    const session = getApiSession();
    if (!session?.token || !window.CCApi || typeof window.CCApi.me !== "function") {
      return null;
    }
    try {
      const data = await window.CCApi.me();
      const user = mapApiUserToFrontendUser(data?.user || session.user || {}, session?.user?.email || "");
      saveUserSession(user);
      if (user.operator) {
        persistSelectedBus(user.operator);
      } else if (user.buses?.[0]) {
        persistSelectedBus(user.buses[0]);
      } else {
        persistSelectedBus("");
      }
      return user;
    } catch (_err) {
      return null;
    }
  }

  function getBusHome(bus) {
    const normalizedBus = normalizeBus(bus);
    return normalizedBus === "ga" ? "golden-arrow-dashboard.html" : "myciti-dashboard.html";
  }

  function getProtectedRouteBus(pathname) {
    const path = String(pathname || location.pathname || "").toLowerCase();
    const file = path.split("/").pop() || "";
    if (
      file === "golden-arrow-dashboard.html" ||
      file === "golden-arrow-timetable.html"
    ) {
      return "ga";
    }
    if (
      file === "myciti-dashboard.html" ||
      file === "myciti-timetable.html" ||
      file === "timetable.html"
    ) {
      return "myciti";
    }
    return "";
  }

  function isProtectedRoute(pathname) {
    const path = String(pathname || location.pathname || "").toLowerCase();
    const file = path.split("/").pop() || "";
    return [
      "choose-bus.html",
      "profile.html",
      "dashboard.html",
      "myciti-dashboard.html",
      "golden-arrow-dashboard.html",
      "myciti-timetable.html",
      "golden-arrow-timetable.html",
      "timetable.html",
    ].includes(file);
  }

  async function guardCurrentPage() {
    if (!isProtectedRoute()) return;
    const file = String(location.pathname || "").toLowerCase().split("/").pop() || "";

    const session = getApiSession();
    if (!session?.token) {
      clearLocalUserState();
      window.location.href = "login.html";
      return;
    }

    const user = await hydrateUserFromSession();
    if (!user) {
      clearLocalUserState();
      if (window.CCApi && typeof window.CCApi.clearAuthSession === "function") {
        window.CCApi.clearAuthSession();
      }
      window.location.href = "login.html";
      return;
    }

    if (user.role === "admin") {
      const adminPages = ["admin.html"];
      if (!adminPages.includes(file)) {
        window.location.href = "admin.html";
        return;
      }
    }

    if (location.pathname.toLowerCase().endsWith("choose-bus.html")) {
      return;
    }

    const linkedBuses = uniqueBuses(user?.buses || []);
    const requiredBus = getProtectedRouteBus();
    let selectedBus = readSelectedBus();

    if (!selectedBus && linkedBuses[0]) {
      selectedBus = linkedBuses[0];
      persistSelectedBus(selectedBus);
    }

    if (!selectedBus) {
      if (file === "profile.html") {
        return;
      }
      window.location.href = "choose-bus.html";
      return;
    }

    if (requiredBus) {
      if (!linkedBuses.includes(requiredBus)) {
        window.location.href = linkedBuses[0] ? getBusHome(linkedBuses[0]) : "choose-bus.html";
        return;
      }
      if (selectedBus !== requiredBus) {
        persistSelectedBus(requiredBus);
      }
    } else if (!linkedBuses.includes(selectedBus)) {
      if (file === "profile.html") {
        return;
      }
      window.location.href = linkedBuses[0] ? getBusHome(linkedBuses[0]) : "choose-bus.html";
    }
  }

  function showError(id, visible) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", !visible);
  }

  function isEmailOrPhone(value) {
    const emailOk = /.+@.+\..+/.test(value);
    const phoneOk = /^\d{10}$/.test(value.replace(/\D/g, ""));
    return emailOk || phoneOk;
  }

  async function handleLogin(event) {
    event.preventDefault();

    const identity = document.getElementById("email")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";

    const identityOk = /.+@.+\..+/.test(identity);
    const passwordOk = password.length > 0;
    showError("email-error", !identityOk);
    showError("password-error", false);

    if (!identityOk || !passwordOk) return;
    if (!window.CCApi || typeof window.CCApi.login !== "function") {
      showError("password-error", true);
      const passwordError = document.getElementById("password-error");
      if (passwordError) {
        passwordError.textContent = "Backend login is unavailable. Start the API and try again.";
      }
      return;
    }

    try {
      const data = await window.CCApi.login(identity, password, true);
      const user = mapApiUserToFrontendUser(data?.user || {}, identity);
      saveUserSession(user);
      const selectedBus = user.buses?.[0] || "";
      if (selectedBus) {
        persistSelectedBus(selectedBus);
      } else {
        persistSelectedBus("");
      }
      window.location.href = user.role === "admin" ? "admin.html" : (selectedBus ? getBusHome(selectedBus) : "choose-bus.html");
    } catch (error) {
      showError("password-error", true);
      const passwordError = document.getElementById("password-error");
      if (passwordError) {
        passwordError.textContent = error?.message || "Invalid credentials. Check your details and try again.";
      }
    }
  }

  function updatePasswordChecklist(password) {
    const rules = [
      ["req-len", password.length >= 8],
      ["req-num", /\d/.test(password)],
      ["req-spec", /[^A-Za-z0-9]/.test(password)],
    ];

    rules.forEach(([id, passed]) => {
      const item = document.getElementById(id);
      if (!item) return;
      item.classList.toggle("requirement-met", passed);
      item.classList.toggle("requirement-not-met", !passed);
    });
  }

  async function handleSignup(event) {
    event.preventDefault();

    const name = document.getElementById("name")?.value?.trim() || "";
    const surname = document.getElementById("surname")?.value?.trim() || "";
    const identity = document.getElementById("email")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";
    const confirmPassword = document.getElementById("confirm-password")?.value || "";

    const identityOk = /.+@.+\..+/.test(identity);
    const passwordStrong = password.length >= 8 && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
    const passwordMatch = password === confirmPassword;

    showError("email-error", !identityOk);
    showError("password-error", !passwordStrong);
    showError("confirm-error", !passwordMatch);

    if (!name || !surname || !identityOk || !passwordStrong || !passwordMatch) return;
    if (!window.CCApi || typeof window.CCApi.register !== "function") {
      showError("password-error", true);
      const passwordError = document.getElementById("password-error");
      if (passwordError) {
        passwordError.textContent = "Backend signup is unavailable. Start the API and try again.";
      }
      return;
    }

    try {
      const data = await window.CCApi.register(
        {
          fullName: `${name} ${surname}`.trim(),
          email: identity,
          password,
        },
        true
      );
      const user = mapApiUserToFrontendUser(data?.user || {}, identity);
      user.isNew = true;
      saveUserSession(user);
      persistSelectedBus("");
      window.location.href = "choose-bus.html";
    } catch (error) {
      showError("password-error", true);
      const passwordError = document.getElementById("password-error");
      if (passwordError) {
        passwordError.textContent = error?.message || "Could not create your account. Try again.";
      }
    }
  }

  async function selectBus(bus) {
    const normalizedBus = String(bus || "").toLowerCase();
    if (normalizedBus !== "myciti" && normalizedBus !== "ga") return;

    const user = getCurrentUser();
    const nextBuses = uniqueBuses([...(user?.buses || []), normalizedBus]);
    persistSelectedBus(normalizedBus);
    if (!window.CCApi || typeof window.CCApi.updateMe !== "function" || !getApiSession()?.token) {
      window.location.href = getBusHome(normalizedBus);
      return;
    }
    try {
      const data = await window.CCApi.updateMe({ operator: normalizedBus, buses: nextBuses });
      const updatedUser = mapApiUserToFrontendUser(data?.user || {}, user?.email || "");
      saveUserSession(updatedUser);
    } catch (_error) {
      // Prefer forward progress into the selected flow; the backend state can be retried later.
    }
    window.location.href = getBusHome(normalizedBus);
  }

  async function switchBus(bus) {
    const normalizedBus = normalizeBus(bus);
    if (!normalizedBus) return;

    const user = getCurrentUser();
    const buses = uniqueBuses(user?.buses || [readSelectedBus()]);
    if (buses.length > 0 && !buses.includes(normalizedBus)) {
      window.alert("This account is not linked to that bus service yet.");
      return;
    }

    persistSelectedBus(normalizedBus);
    if (window.CCApi && typeof window.CCApi.updateMe === "function" && getApiSession()?.token) {
      try {
        const data = await window.CCApi.updateMe({ operator: normalizedBus, buses });
        saveUserSession(mapApiUserToFrontendUser(data?.user || {}, user?.email || ""));
      } catch (_error) {
        // Keep the local switch responsive even if the backend update fails.
      }
    }
    window.location.href = getBusHome(normalizedBus);
  }

  function confirmLogout() {
    clearLocalUserState();
    const done = () => {
      window.location.href = "login.html";
    };
    if (window.CCApi && typeof window.CCApi.logout === "function" && getApiSession()?.token) {
      window.CCApi.logout().then(done).catch(done);
      return;
    }
    if (window.CCApi && typeof window.CCApi.clearAuthSession === "function") {
      window.CCApi.clearAuthSession();
    }
    done();
  }

  function wirePasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
      button.addEventListener("click", () => {
        const inputId = button.getAttribute("data-toggle-password");
        const input = document.getElementById(inputId);
        if (!input) return;
        const nextType = input.type === "password" ? "text" : "password";
        input.type = nextType;
        button.textContent = nextType === "password" ? "Show" : "Hide";
      });
    });
  }

  function initializeSignupPage() {
    const password = document.getElementById("password");
    if (!password) return;
    updatePasswordChecklist(password.value);
    password.addEventListener("input", () => updatePasswordChecklist(password.value));
  }

  window.App = {
    toggleTheme,
    initializeTheme,
    selectBus,
    switchBus,
    confirmLogout,
    hydrateUserSession: hydrateUserFromSession,
    storage: {
      get(key) {
        if (key === USER_KEY || key === LEGACY_USER_KEY || key === "currentUser" || key === "capeConnectUser") {
          return getCurrentUser();
        }
        if (key === BUS_KEY) {
          return readSelectedBus();
        }
        return readJson(key, null);
      },
      save(key, value) {
        if (key === USER_KEY || key === LEGACY_USER_KEY || key === "currentUser" || key === "capeConnectUser") {
          saveCurrentUser(value);
          return;
        }
        if (key === BUS_KEY) {
          persistSelectedBus(value);
          return;
        }
        writeJson(key, value);
      },
      remove(key) {
        if (key === USER_KEY || key === LEGACY_USER_KEY || key === "currentUser" || key === "capeConnectUser") {
          storage.removeItem(USER_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(LEGACY_USER_KEY);
          return;
        }
        if (key === BUS_KEY) {
          persistSelectedBus("");
          return;
        }
        storage.removeItem(key);
      },
    },
  };
  window.handleLogin = handleLogin;
  window.handleSignup = handleSignup;

  document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    wireBackButtons();
    wirePasswordToggles();
    initializeSignupPage();
    guardCurrentPage();
    if (document.body.classList.contains("page-choose") || location.pathname.endsWith("profile.html")) {
      hydrateUserFromSession();
    }
  });
})();
