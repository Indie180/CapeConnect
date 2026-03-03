(function () {
  const TICKET_KEY = "ccTickets_v1";

  function parseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (err) {
      return fallback;
    }
  }

  function storageGet(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined || raw === "") return fallback;
    return parseJson(raw, fallback);
  }

  function storageSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function storageRemove(key) {
    localStorage.removeItem(key);
  }

  function getCurrentUser() {
    return storageGet("currentUser", null);
  }

  function getCurrentUserKey() {
    const user = getCurrentUser();
    if (!user || typeof user !== "object") return "";
    const raw = String(user.email || user.phone || "").trim().toLowerCase();
    return raw;
  }

  function hasApiAuth() {
    return Boolean(window.CCApi && typeof window.CCApi.getToken === "function" && window.CCApi.getToken());
  }

  function mapTicketToApiPayload(ticket) {
    const normalized = normalizeTicket(ticket || {});
    if (!normalized) return null;

    const operatorRaw = String(normalized.operator || normalized.service || "").toLowerCase();
    const operator = operatorRaw.includes("golden") ? "GoldenArrow" : "MyCiTi";
    const productType = String(normalized.type || "single").toLowerCase();
    const productName = String(normalized.type || normalized.ticketType || "Ticket");
    const parts = String(normalized.route || "").split("-").map((s) => s.trim()).filter(Boolean);
    const amountNumber = Number(
      String(normalized.total || "")
        .replace(/[^\d.-]/g, "")
        .trim()
    );
    const amountCents = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : 0;

    return {
      operator,
      productType,
      productName,
      journeysIncluded: Number(normalized.journeysIncluded || 0) || null,
      routeFrom: parts[0] || null,
      routeTo: parts[1] || null,
      amountCents,
      currency: "ZAR",
      validFrom: normalized.validFrom || null,
      validUntil: normalized.expiresAt || null,
      paymentMethod: "card",
      cardAlias: normalized.cardAlias || null,
      meta: {
        legacyTicketId: normalized.id || null,
        source: "frontend-migration",
      },
    };
  }

  function mapApiTicketToLocal(row) {
    if (!row || typeof row !== "object") return null;
    const route = [row.route_from, row.route_to].filter(Boolean).join(" - ");
    const amountCents = Number(row.amount_cents || 0);
    const normalizedOperator = String(row.operator || "").toLowerCase().includes("golden")
      ? "Golden Arrow"
      : "MyCiTi";
    const mapped = {
      id: row.id || null,
      operator: normalizedOperator,
      service: normalizedOperator,
      route: route || row.product_name || "",
      type: row.product_type || row.product_name || "ticket",
      total: formatZarFromCents(amountCents),
      purchasedAt: row.purchased_at || nowIso(),
      validFrom: row.valid_from || row.purchased_at || nowIso(),
      expiresAt: row.valid_until || addDaysIso(row.purchased_at || nowIso(), 30),
      journeysIncluded: row.journeys_included || null,
      remainingUses:
        row.journeys_included && Number.isFinite(Number(row.journeys_used))
          ? Math.max(0, Number(row.journeys_included) - Number(row.journeys_used))
          : null,
      status: String(row.status || "").toUpperCase() === "PAID" ? "Active" : "Used",
      meta: row.meta || null,
      _api: true,
    };
    return normalizeTicket(mapped);
  }

  function withOwner(ticket, ownerKey) {
    if (!ticket || typeof ticket !== "object") return ticket;
    if (ticket.ownerKey) return ticket;
    return { ...ticket, ownerKey };
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatZarFromCents(cents) {
    return "R " + (Number(cents || 0) / 100).toFixed(2);
  }

  function addDaysIso(iso, days) {
    const base = new Date(iso || nowIso());
    return new Date(base.getTime() + Number(days || 0) * 24 * 60 * 60 * 1000).toISOString();
  }

  function inferExpiryDays(ticket) {
    const type = String(ticket?.type || ticket?.ticketType || "").toLowerCase();
    const operator = String(ticket?.operator || ticket?.service || "").toLowerCase();
    if (type.includes("day1")) return 1;
    if (type.includes("day3")) return 3;
    if (type.includes("day7")) return 7;
    if (type.includes("monthly")) return 30;
    if (type.includes("weekly")) return 7;
    if (type.includes("five") || type.includes("ride5")) return 30;
    if (type.includes("topup") || type.includes("mover")) return 365;
    if (operator.includes("golden")) return 30;
    return 30;
  }

  function deriveLifecycle(ticket) {
    const purchasedAt = ticket?.purchasedAt || ticket?.createdAt || nowIso();
    const validFrom = ticket?.validFrom || purchasedAt;
    const expiresAt = ticket?.expiresAt || addDaysIso(validFrom, inferExpiryDays(ticket));
    let remainingUses = ticket?.remainingUses;
    if (remainingUses === undefined || remainingUses === null) {
      const journeys = Number(ticket?.journeysIncluded || 0);
      if (journeys > 0) remainingUses = journeys;
    }
    const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
    let status = String(ticket?.status || "Active").toLowerCase();
    if (ticket?.usedAt || (Number.isFinite(Number(remainingUses)) && Number(remainingUses) <= 0)) {
      status = "used";
    } else if (expired) {
      status = "expired";
    } else {
      status = "active";
    }
    const normalizedStatus = status === "used" ? "Used" : (status === "expired" ? "Expired" : "Active");
    return { validFrom, expiresAt, remainingUses, status: normalizedStatus };
  }

  function normalizeTicket(ticket) {
    if (!ticket || typeof ticket !== "object") return null;
    const operatorRaw = String(ticket.operator || ticket.service || "").toLowerCase();
    const operator = operatorRaw.includes("golden")
      ? "Golden Arrow"
      : (operatorRaw.includes("myciti") ? "MyCiTi" : (ticket.operator || ticket.service || "MyCiTi"));
    const route = ticket.route || ticket.trip || "";
    const purchasedAt = ticket.purchasedAt || ticket.createdAt || nowIso();
    const date = ticket.date || String(purchasedAt).slice(0, 10);
    const time = ticket.time || new Date(purchasedAt).toTimeString().slice(0, 5);
    const id = ticket.id || ("TCK-" + Date.now() + "-" + Math.floor(Math.random() * 1000));
    const total = ticket.total || (Number.isFinite(ticket.amountCents) ? formatZarFromCents(ticket.amountCents) : "");
    const lifecycle = deriveLifecycle(ticket);
    return {
      ...ticket,
      id,
      operator,
      service: ticket.service || operator,
      route,
      date,
      time,
      total,
      status: lifecycle.status,
      purchasedAt,
      validFrom: lifecycle.validFrom,
      expiresAt: lifecycle.expiresAt,
      remainingUses: lifecycle.remainingUses
    };
  }

  function getTickets() {
    const list = storageGet(TICKET_KEY, []);
    const all = Array.isArray(list) ? list : [];
    const ownerKey = getCurrentUserKey();
    if (!ownerKey) return [];
    return all.filter((t) => t && String(t.ownerKey || "").toLowerCase() === ownerKey);
  }

  async function syncTicketsFromApi() {
    if (!hasApiAuth() || !window.CCApi || typeof window.CCApi.getTickets !== "function") {
      return getTickets();
    }
    try {
      const resp = await window.CCApi.getTickets();
      let rows = Array.isArray(resp?.tickets) ? resp.tickets : [];
      if (!rows.length) {
        const localList = getTickets().map(normalizeTicket).filter(Boolean);
        for (let i = 0; i < Math.min(localList.length, 20); i += 1) {
          const payload = mapTicketToApiPayload(localList[i]);
          if (!payload || Number(payload.amountCents || 0) <= 0) continue;
          try {
            // eslint-disable-next-line no-await-in-loop
            await window.CCApi.createTicket(payload);
          } catch (_uploadErr) {
            // Continue best-effort migration.
          }
        }
        const refreshed = await window.CCApi.getTickets();
        rows = Array.isArray(refreshed?.tickets) ? refreshed.tickets : [];
      }
      const mapped = rows
        .map(mapApiTicketToLocal)
        .filter(Boolean);
      saveTickets(mapped);
      return mapped;
    } catch (_err) {
      return getTickets();
    }
  }

  function saveTickets(list) {
    const ownerKey = getCurrentUserKey();
    if (!ownerKey) return [];

    const all = storageGet(TICKET_KEY, []);
    const others = (Array.isArray(all) ? all : []).filter(
      (t) => String(t?.ownerKey || "").toLowerCase() !== ownerKey
    );
    const scoped = (Array.isArray(list) ? list : [])
      .slice(0, 50)
      .map((t) => withOwner(t, ownerKey));
    const merged = [...scoped, ...others];
    storageSet(TICKET_KEY, merged);
    return scoped;
  }

  function addTicket(ticket) {
    const list = getTickets();
    list.unshift(ticket);
    const saved = saveTickets(list);
    if (hasApiAuth() && window.CCApi && typeof window.CCApi.createTicket === "function") {
      const payload = mapTicketToApiPayload(ticket);
      if (payload && Number(payload.amountCents || 0) > 0) {
        window.CCApi
          .createTicket(payload)
          .then(() => syncTicketsFromApi())
          .catch(() => null);
      }
    }
    return saved;
  }

  async function useTicket(ticketId) {
    const id = String(ticketId || "").trim();
    if (!id) throw new Error("ticketId is required");

    if (hasApiAuth() && window.CCApi && typeof window.CCApi.useTicket === "function") {
      const resp = await window.CCApi.useTicket(id);
      const mapped = mapApiTicketToLocal(resp?.ticket);
      if (mapped) {
        const ownerList = getTickets();
        const next = ownerList.map((t) => (String(t?.id || "") === String(mapped.id || "") ? mapped : t));
        saveTickets(next);
        return mapped;
      }
    }

    const ownerList = getTickets();
    let updated = null;
    const next = ownerList.map((t) => {
      if (!t || String(t.id || "") !== id) return t;
      const normalized = normalizeTicket(t);
      if (!normalized) return t;
      const uses = Number(normalized.remainingUses);
      if (Number.isFinite(uses)) {
        const nextUses = Math.max(0, uses - 1);
        updated = {
          ...normalized,
          remainingUses: nextUses,
          status: nextUses <= 0 ? "Used" : "Active",
          lastUsedAt: nowIso(),
          usedAt: nextUses <= 0 ? nowIso() : normalized.usedAt || null,
        };
        return updated;
      }
      updated = { ...normalized, status: "Active", lastUsedAt: nowIso() };
      return updated;
    });
    saveTickets(next);
    return updated;
  }

  function isTicketActive(ticket) {
    if (!ticket) return false;
    const normalized = normalizeTicket(ticket);
    if (!normalized) return false;
    return normalized.status === "Active";
  }

  function getActiveTicket(filterFn) {
    const list = getTickets().map(normalizeTicket).filter(Boolean);
    for (let i = 0; i < list.length; i += 1) {
      const t = list[i];
      if (t.status !== "Active") continue;
      if (typeof filterFn === "function" && !filterFn(t)) continue;
      return t;
    }
    return null;
  }

  window.CCUtils = {
    TICKET_KEY,
    parseJson,
    storageGet,
    storageSet,
    storageRemove,
    nowIso,
    formatZarFromCents,
    addDaysIso,
    inferExpiryDays,
    deriveLifecycle,
    normalizeTicket,
    getTickets,
    syncTicketsFromApi,
    saveTickets,
    addTicket,
    useTicket,
    isTicketActive,
    getActiveTicket
  };
})();
