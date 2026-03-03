(function () {
  const KEYS = {
    session: "MC_ADMIN_SESSION",
    users: "MC_USERS",
    tickets: "MC_TICKETS",
    wallets: "MC_WALLETS",
    timetables: "MC_TIMETABLES",
    pricesGlobal: "MC_PRICES_GLOBAL",
    pricesRoutes: "MC_PRICES_ROUTES",
    audit: "MC_AUDIT_LOGS",
    backups: "MC_BACKUPS",
    settings: "MC_ADMIN_SETTINGS",
    seedFlag: "MC_SEEDED_V1"
  };

  const OPERATOR = "MyCiTi";
  const EXPECTED_ADMIN_EMAIL = "myciti-admin@capeconnect.demo";
  const DEFAULT_ADMIN = {
    email: EXPECTED_ADMIN_EMAIL,
    password: "",
    phrase: "MYCITI-ADMIN",
    sessionMinutes: 30
  };

  const PRODUCT_MAP = {
    topup: { label: "Top Up (Mover)", journeys: 0 },
    day1: { label: "1 Day Pass", journeys: 1 },
    day3: { label: "3 Day Pass", journeys: 3 },
    day7: { label: "7 Day Pass", journeys: 7 },
    monthly: { label: "Monthly Pass", journeys: 30 }
  };

  const BASE_URL = (window.CC_API_BASE_URL || localStorage.getItem("ccApiBaseUrl") || "http://localhost:4000").replace(/\/+$/, "");
  let syncInFlight = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_err) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function getSettings() {
    return { ...DEFAULT_ADMIN, ...read(KEYS.settings, {}) };
  }

  function getSession() {
    const sess = read(KEYS.session, null);
    if (!sess || !sess.expiresAt) return null;
    if (new Date(sess.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(KEYS.session);
      return null;
    }
    return sess;
  }

  async function apiRequest(path, options) {
    const sess = getSession();
    const headers = { "Content-Type": "application/json", ...(options?.headers || {}) };
    if (sess?.token) headers.Authorization = `Bearer ${sess.token}`;
    const res = await fetch(`${BASE_URL}${path}`, {
      method: options?.method || "GET",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (_err) { data = null; }
    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function login(email, password, phrase) {
    const cfg = getSettings();
    if (String(phrase || "").trim() !== String(cfg.phrase || "MYCITI-ADMIN")) {
      return { ok: false, message: "Invalid access phrase." };
    }
    try {
      const data = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(email || "").trim().toLowerCase(), password: String(password || "") })
      }).then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(payload?.error || `HTTP ${r.status}`);
        return payload;
      });

      const role = String(data?.user?.role || "").toLowerCase();
      const userEmail = String(data?.user?.email || "").toLowerCase();
      const isAdmin = role === "operator_admin" || role === "super_admin";
      if (!isAdmin || !userEmail.includes("myciti-admin")) {
        return { ok: false, message: "Account is not authorized for MyCiTi admin." };
      }

      const session = {
        token: data.token,
        refreshToken: data.refreshToken || null,
        email: data?.user?.email || userEmail,
        role: data?.user?.role || "operator_admin",
        issuedAt: nowIso(),
        expiresAt: data.expiresAt || new Date(Date.now() + 30 * 60000).toISOString()
      };
      write(KEYS.session, session);
      await initRemote(true);
      await logAudit("ADMIN_LOGIN", "SESSION", session.email, null, { email: session.email });
      return { ok: true, session };
    } catch (err) {
      return { ok: false, message: err?.message || "Login failed." };
    }
  }

  async function logout() {
    const sess = getSession();
    try {
      if (sess?.token) {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          body: sess.refreshToken ? { refreshToken: sess.refreshToken } : {}
        });
      }
    } catch (_err) {
      // Ignore logout errors and clear local session.
    } finally {
      localStorage.removeItem(KEYS.session);
      window.location.href = "login.html";
    }
  }

  function requireAuth() {
    if (!getSession()) {
      window.location.href = "login.html";
    }
  }

  function seeded() {
    return localStorage.getItem(KEYS.seedFlag) === "1";
  }

  function seedData() {
    if (seeded()) return;
    write(KEYS.users, read(KEYS.users, []));
    write(KEYS.tickets, read(KEYS.tickets, []));
    write(KEYS.wallets, read(KEYS.wallets, []));
    write(KEYS.timetables, read(KEYS.timetables, []));
    write(KEYS.pricesGlobal, read(KEYS.pricesGlobal, []));
    write(KEYS.pricesRoutes, read(KEYS.pricesRoutes, []));
    write(KEYS.audit, read(KEYS.audit, []));
    write(KEYS.backups, read(KEYS.backups, []));
    write(KEYS.settings, getSettings());
    localStorage.setItem(KEYS.seedFlag, "1");
  }

  async function initRemote(force) {
    const sess = getSession();
    if (!sess?.token) return false;
    if (!force && syncInFlight) return syncInFlight;
    syncInFlight = (async function () {
      const data = await apiRequest(`/api/admin/bootstrap?operator=${encodeURIComponent(OPERATOR)}`);
      write(KEYS.users, Array.isArray(data?.users) ? data.users : []);
      write(KEYS.tickets, Array.isArray(data?.tickets) ? data.tickets : []);
      write(KEYS.wallets, Array.isArray(data?.wallets) ? data.wallets : []);
      write(KEYS.timetables, Array.isArray(data?.timetables) ? data.timetables : []);
      write(KEYS.pricesGlobal, Array.isArray(data?.pricesGlobal) ? data.pricesGlobal : []);
      write(KEYS.pricesRoutes, Array.isArray(data?.pricesRoutes) ? data.pricesRoutes : []);
      write(KEYS.audit, Array.isArray(data?.audit) ? data.audit : []);
      localStorage.setItem(KEYS.seedFlag, "1");
      window.dispatchEvent(new Event("admin-data-updated"));
      return true;
    })().finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  }

  async function pushUsers(users) {
    await apiRequest("/api/admin/users/bulk", { method: "POST", body: { operator: OPERATOR, users: Array.isArray(users) ? users : [] } });
  }

  async function pushTickets(tickets) {
    await apiRequest("/api/admin/tickets/bulk", { method: "POST", body: { operator: OPERATOR, tickets: Array.isArray(tickets) ? tickets : [] } });
  }

  async function pushWallets(wallets) {
    await apiRequest("/api/admin/wallets/bulk", { method: "POST", body: { operator: OPERATOR, wallets: Array.isArray(wallets) ? wallets : [] } });
  }

  async function pushPricesGlobal(pricesGlobal) {
    await apiRequest("/api/admin/prices/global/bulk", { method: "POST", body: { operator: OPERATOR, pricesGlobal: Array.isArray(pricesGlobal) ? pricesGlobal : [] } });
  }

  async function pushPricesRoutes(pricesRoutes) {
    await apiRequest("/api/admin/prices/routes/bulk", { method: "POST", body: { operator: OPERATOR, pricesRoutes: Array.isArray(pricesRoutes) ? pricesRoutes : [] } });
  }

  async function pushTimetables(timetables) {
    await apiRequest("/api/admin/timetables/bulk", { method: "POST", body: { operator: OPERATOR, timetables: Array.isArray(timetables) ? timetables : [] } });
  }

  function fmtCurrency(n) {
    return `R ${Number(n || 0).toFixed(2)}`;
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  }

  function getUsers() { return read(KEYS.users, []); }
  function saveUsers(v) {
    const out = write(KEYS.users, v);
    pushUsers(out).then(() => initRemote(true)).catch(() => null);
    return out;
  }
  function getTickets() { return read(KEYS.tickets, []); }
  function saveTickets(v) {
    const out = write(KEYS.tickets, v);
    pushTickets(out).then(() => initRemote(true)).catch(() => null);
    return out;
  }
  function getWallets() { return read(KEYS.wallets, []); }
  function saveWallets(v) {
    const out = write(KEYS.wallets, v);
    pushWallets(out).then(() => initRemote(true)).catch(() => null);
    return out;
  }
  function getTimetables() { return read(KEYS.timetables, []); }
  function saveTimetables(v) {
    const out = write(KEYS.timetables, v);
    pushTimetables(out).then(() => initRemote(true)).catch(() => null);
    return out;
  }
  function getPricesGlobal() { return read(KEYS.pricesGlobal, []); }
  function savePricesGlobal(v) {
    const out = write(KEYS.pricesGlobal, v);
    pushPricesGlobal(out).then(() => initRemote(true)).catch(() => null);
    return out;
  }
  function getPricesRoutes() { return read(KEYS.pricesRoutes, []); }
  function savePricesRoutes(v) {
    const out = write(KEYS.pricesRoutes, v);
    pushPricesRoutes(out).then(() => initRemote(true)).catch(() => null);
    return out;
  }
  function getAudit() { return read(KEYS.audit, []); }
  function saveAudit(v) { return write(KEYS.audit, v); }

  async function logAudit(action, targetType, targetId, before, after) {
    const sess = getSession();
    const logs = getAudit();
    const entry = {
      id: uid("audit"),
      at: nowIso(),
      adminEmail: sess?.email || EXPECTED_ADMIN_EMAIL,
      action,
      targetType,
      targetId,
      before: before || null,
      after: after || null
    };
    logs.unshift(entry);
    saveAudit(logs);
    try {
      await apiRequest("/api/admin/audit", { method: "POST", body: { operator: OPERATOR, entry } });
    } catch (_err) {
      // Keep local log even if backend audit endpoint fails.
    }
    return entry;
  }

  function applyLayout(pageId, pageTitle) {
    const nav = document.querySelectorAll(".nav-list a[data-page]");
    nav.forEach((n) => n.classList.toggle("active", n.dataset.page === pageId));
    const title = document.getElementById("page-title");
    if (title && pageTitle) title.textContent = pageTitle;

    const sess = getSession();
    const emailEl = document.getElementById("admin-email");
    if (emailEl) emailEl.textContent = sess?.email || EXPECTED_ADMIN_EMAIL;

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.onclick = function () { logout(); };

    const searchInput = document.getElementById("global-search");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        const q = this.value.toLowerCase();
        document.querySelectorAll('[data-searchable="true"]').forEach((row) => {
          row.classList.toggle("hidden", !row.textContent.toLowerCase().includes(q));
        });
      });
    }
  }

  function dashboardMetrics() {
    const users = getUsers();
    const tickets = getTickets();
    const wallets = getWallets();
    const totalRevenue = tickets.filter((t) => t.status === "PAID").reduce((s, t) => s + Number(t.amount || 0), 0);
    const activeUsers = users.filter((u) => u.status === "ACTIVE").length;
    const blacklisted = users.filter((u) => u.status === "BLACKLISTED").length;
    const walletTotal = wallets.reduce((s, w) => s + Number(w.balance || 0), 0);
    return { ticketsSold: tickets.length, totalRevenue, activeUsers, blacklisted, walletTotal };
  }

  window.MCAdmin = {
    KEYS,
    PRODUCT_MAP,
    seedData,
    initRemote,
    getSession,
    requireAuth,
    login,
    logout,
    getSettings,
    saveSettings: (v) => write(KEYS.settings, v),
    getUsers,
    saveUsers,
    getTickets,
    saveTickets,
    getWallets,
    saveWallets,
    getTimetables,
    saveTimetables,
    getPricesGlobal,
    savePricesGlobal,
    getPricesRoutes,
    savePricesRoutes,
    getAudit,
    saveAudit,
    logAudit,
    uid,
    nowIso,
    fmtCurrency,
    formatDateTime,
    dashboardMetrics,
    applyLayout,
    read,
    write,
    seeded
  };

  seedData();
  initRemote(false).catch(() => null);
})();
