const AUTH_KEY = "ccAuthSession";
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

export function readSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function writeSession(session, remember) {
  const payload = JSON.stringify(session || null);
  if (remember) {
    localStorage.setItem(AUTH_KEY, payload);
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
  sessionStorage.setItem(AUTH_KEY, payload);
}

function getToken() {
  return String(readSession()?.token || "");
}

function getRefreshToken() {
  return String(readSession()?.refreshToken || "");
}

function setUpdatedSession(data) {
  const current = readSession() || {};
  const remember = Boolean(localStorage.getItem(AUTH_KEY));
  const next = {
    ...current,
    token: data?.token || current.token || null,
    expiresAt: data?.expiresAt || current.expiresAt || null,
    refreshToken: data?.refreshToken || current.refreshToken || null,
    refreshExpiresAt: data?.refreshExpiresAt || current.refreshExpiresAt || null,
    user: data?.user || current.user || null,
  };
  writeSession(next, remember);
  return next;
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
}

async function rawRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (!options.skipAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || `HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

let refreshInFlight = null;

export async function refresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("Missing refresh token");
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = rawRequest("/api/auth/refresh", {
    method: "POST",
    skipAuth: true,
    body: { refreshToken },
  })
    .then((data) => {
      setUpdatedSession(data);
      return data;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function request(path, options = {}, retryOn401 = true) {
  try {
    return await rawRequest(path, options);
  } catch (err) {
    if (retryOn401 && err?.status === 401 && !options.skipAuth) {
      try {
        await refresh();
        return await rawRequest(path, options);
      } catch (_refreshErr) {
        clearSession();
      }
    }
    throw err;
  }
}

export async function login(email, password, remember = true) {
  const data = await request("/api/auth/login", {
    method: "POST",
    skipAuth: true,
    body: {
      email: String(email || "").trim().toLowerCase(),
      password: String(password || ""),
    },
  });

  const session = {
    token: data.token,
    refreshToken: data.refreshToken || null,
    expiresAt: data.expiresAt || null,
    refreshExpiresAt: data.refreshExpiresAt || null,
    user: data.user || null,
  };
  writeSession(session, remember);
  return session;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    await request("/api/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
    });
  } finally {
    clearSession();
  }
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export async function me() {
  return request("/api/auth/me");
}

export async function getTickets(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    query.set(k, String(v));
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/api/tickets${suffix}`);
}

export async function getWalletMe() {
  return request("/api/wallets/me");
}

export const authConfig = {
  AUTH_KEY,
  BASE_URL,
};
