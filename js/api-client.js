(function () {
  const BASE_URL = (window.CC_API_BASE_URL || localStorage.getItem("ccApiBaseUrl") || "http://localhost:4000").replace(/\/+$/, "");
  const AUTH_KEY = "ccAuthSession";

  function readAuthSession() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  function writeAuthSession(session, persist = true) {
    const payload = JSON.stringify(session || null);
    if (persist) localStorage.setItem(AUTH_KEY, payload);
    sessionStorage.setItem(AUTH_KEY, payload);
  }

  function clearAuthSession() {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  }

  function getToken() {
    const session = readAuthSession();
    if (!session || !session.token) return "";
    return String(session.token);
  }

  function getRefreshToken() {
    const session = readAuthSession();
    if (!session || !session.refreshToken) return "";
    return String(session.refreshToken);
  }

  async function rawRequest(path, options = {}) {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_err) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error || data?.detail || `HTTP ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  let refreshInFlight = null;

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("Missing refresh token");
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = rawRequest("/api/auth/refresh", {
      method: "POST",
      skipAuth: true,
      body: { refreshToken },
    })
      .then((data) => {
        const current = readAuthSession() || {};
        writeAuthSession(
          {
            ...current,
            token: data.token,
            expiresAt: data.expiresAt || null,
            refreshToken: data.refreshToken || current.refreshToken || null,
            refreshExpiresAt: data.refreshExpiresAt || current.refreshExpiresAt || null,
            user: data.user || current.user || null,
          },
          true
        );
        return data;
      })
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  }

  async function request(path, options = {}, retryOn401 = true) {
    try {
      return await rawRequest(path, options);
    } catch (err) {
      if (retryOn401 && err?.status === 401 && !options.skipAuth) {
        try {
          await refreshAccessToken();
          return await rawRequest(path, options);
        } catch (_refreshErr) {
          clearAuthSession();
          throw err;
        }
      }
      throw err;
    }
  }

  async function login(email, password, persist = true) {
    const data = await request("/api/auth/login", {
      method: "POST",
      skipAuth: true,
      body: { email, password },
    });
    if (data?.token) {
      writeAuthSession(
        {
          token: data.token,
          expiresAt: data.expiresAt || null,
          refreshToken: data.refreshToken || null,
          refreshExpiresAt: data.refreshExpiresAt || null,
          user: data.user || null,
        },
        persist
      );
    }
    return data;
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      await request("/api/auth/logout", {
        method: "POST",
        body: refreshToken ? { refreshToken } : {},
      });
    } finally {
      clearAuthSession();
    }
  }

  async function me() {
    return request("/api/auth/me");
  }

  async function getTickets(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      query.set(k, String(v));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/tickets${suffix}`);
  }

  async function createTicket(payload) {
    return request("/api/tickets", { method: "POST", body: payload });
  }

  async function useTicket(ticketId) {
    return request(`/api/tickets/${encodeURIComponent(ticketId)}/use`, { method: "POST" });
  }

  async function getWalletMe() {
    return request("/api/wallets/me");
  }

  async function walletTopup(payload) {
    return request("/api/wallets/topup", { method: "POST", body: payload });
  }

  async function walletSpend(payload) {
    return request("/api/wallets/spend", { method: "POST", body: payload });
  }

  async function getRoutes(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      query.set(k, String(v));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/routes${suffix}`, { skipAuth: true });
  }

  async function getStops(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      query.set(k, String(v));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/routes/stops${suffix}`, { skipAuth: true });
  }

  async function getPrices(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      query.set(k, String(v));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/prices${suffix}`, { skipAuth: true });
  }

  async function getTimetables(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      query.set(k, String(v));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/timetables${suffix}`, { skipAuth: true });
  }

  window.CCApi = {
    baseUrl: BASE_URL,
    authKey: AUTH_KEY,
    readAuthSession,
    writeAuthSession,
    clearAuthSession,
    getToken,
    getRefreshToken,
    refreshAccessToken,
    login,
    logout,
    me,
    getTickets,
    createTicket,
    useTicket,
    getWalletMe,
    walletTopup,
    walletSpend,
    getRoutes,
    getStops,
    getPrices,
    getTimetables,
  };
})();
