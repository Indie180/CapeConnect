(function () {
  const cache = {
    myciti: null,
    ga: null
  };

  const FALLBACK_DATA = {
    myciti: {
      stops: [
        { name: "Civic Centre", lat: -33.9249, lon: 18.4241 },
        { name: "Cape Town Station", lat: -33.9250, lon: 18.4240 },
        { name: "Gardens", lat: -33.9353, lon: 18.4148 },
        { name: "Sea Point", lat: -33.9156, lon: 18.3877 },
        { name: "Century City", lat: -33.8920, lon: 18.5110 },
        { name: "Table View", lat: -33.8269, lon: 18.4909 },
        { name: "Dunoon", lat: -33.8642, lon: 18.5366 },
        { name: "Melkbosstrand", lat: -33.7250, lon: 18.4450 },
        { name: "Atlantis", lat: -33.5667, lon: 18.4833 },
        { name: "Hout Bay", lat: -34.0436, lon: 18.3489 }
      ],
      passPrices: { day3: 210, day7: 300, monthly: 1000 },
      moverFareBands: [
        { min: 0, max: 5, peak: 13.5, saver: 10.5 },
        { min: 5, max: 10, peak: 18.5, saver: 13.5 },
        { min: 10, max: 20, peak: 23.5, saver: 18.5 },
        { min: 20, max: 30, peak: 25.5, saver: 21.5 },
        { min: 30, max: 40, peak: 27.5, saver: 23.5 },
        { min: 40, max: 50, peak: 31.5, saver: 28.5 },
        { min: 50, max: 60, peak: 36.5, saver: 31.5 },
        { min: 60, max: 9999, peak: 39.5, saver: 33.5 }
      ]
    },
    ga: {
      products: {
        five: { label: "5 Ride (5 journeys)", journeysIncluded: 5 },
        weekly: { label: "Weekly (10 journeys)", journeysIncluded: 10 },
        monthly: { label: "Monthly (48 journeys)", journeysIncluded: 48 }
      },
      routePairs: [
        {
          from: "Cape Town",
          to: "Khayelitsha",
          faresCents: { five: 12650, weekly: 23400, monthly: 103000 }
        },
        {
          from: "Langa",
          to: "Cape Town",
          faresCents: { five: 11450, weekly: 21200, monthly: 93300 }
        },
        {
          from: "Somerset West",
          to: "Cape Town",
          faresCents: { five: 14750, weekly: 27350, monthly: 120300 }
        }
      ]
    }
  };

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.json();
  }

  function hasApiDataClient() {
    return Boolean(window.CCApi && typeof window.CCApi.getStops === "function" && typeof window.CCApi.getPrices === "function");
  }

  function normalizeApiMycitiStops(stops) {
    if (!Array.isArray(stops)) return [];
    return stops
      .map((s) => ({
        name: String(s?.name || "").trim(),
        lat: Number(s?.lat ?? 0),
        lon: Number(s?.lon ?? 0),
      }))
      .filter((s) => s.name);
  }

  function buildMycitiPassPrices(globalProducts, fallbackPassPrices) {
    const fallback = fallbackPassPrices || FALLBACK_DATA.myciti.passPrices;
    const keyMap = { day3: "day3", day7: "day7", monthly: "monthly" };
    const out = { ...fallback };
    (Array.isArray(globalProducts) ? globalProducts : []).forEach((p) => {
      const raw = String(p?.product_key || "").toLowerCase();
      const key = keyMap[raw];
      if (!key) return;
      const cents = Number(p?.price_cents || 0);
      if (Number.isFinite(cents) && cents > 0) out[key] = cents / 100;
    });
    return out;
  }

  function buildGaProducts(globalProducts, fallbackProducts) {
    const fallback = fallbackProducts || FALLBACK_DATA.ga.products;
    const out = {
      five: { ...fallback.five },
      weekly: { ...fallback.weekly },
      monthly: { ...fallback.monthly },
    };
    const keyMap = {
      five_ride: "five",
      five: "five",
      weekly: "weekly",
      monthly: "monthly",
    };
    (Array.isArray(globalProducts) ? globalProducts : []).forEach((p) => {
      const key = keyMap[String(p?.product_key || "").toLowerCase()];
      if (!key) return;
      const label = String(p?.label || out[key].label || "").trim();
      const journeys = Number(p?.journeys || out[key].journeysIncluded || 0);
      out[key] = {
        label: label || out[key].label,
        journeysIncluded: Number.isFinite(journeys) && journeys > 0 ? journeys : out[key].journeysIncluded,
      };
    });
    return out;
  }

  function buildGaRoutePairs(routePrices, fallbackRoutePairs) {
    const rows = Array.isArray(routePrices) ? routePrices : [];
    if (!rows.length) return fallbackRoutePairs || FALLBACK_DATA.ga.routePairs;
    const keyMap = {
      five_ride: "five",
      five: "five",
      weekly: "weekly",
      monthly: "monthly",
    };
    const grouped = new Map();
    rows.forEach((row) => {
      const from = String(row?.from_stop_name || row?.route_from || "").trim();
      const to = String(row?.to_stop_name || row?.route_to || "").trim();
      if (!from || !to) return;
      const product = keyMap[String(row?.product_key || "").toLowerCase()];
      if (!product) return;
      const cents = Number(row?.price_cents || 0);
      if (!Number.isFinite(cents) || cents <= 0) return;
      const key = `${from}__${to}`;
      if (!grouped.has(key)) {
        grouped.set(key, { from, to, faresCents: {} });
      }
      grouped.get(key).faresCents[product] = cents;
    });
    const built = Array.from(grouped.values()).filter((p) => Object.keys(p.faresCents || {}).length > 0);
    return built.length ? built : (fallbackRoutePairs || FALLBACK_DATA.ga.routePairs);
  }

  async function loadMycitiFromApi() {
    if (!hasApiDataClient()) throw new Error("API client unavailable");
    const getRoutes = (window.CCApi && typeof window.CCApi.getRoutes === "function")
      ? window.CCApi.getRoutes.bind(window.CCApi)
      : async function () { return { routes: [] }; };
    const [stopsResp, pricesResp, routesResp] = await Promise.all([
      window.CCApi.getStops({ operator: "MyCiTi" }),
      window.CCApi.getPrices({ operator: "MyCiTi" }),
      getRoutes({ operator: "MyCiTi" }),
    ]);
    const stops = normalizeApiMycitiStops(stopsResp?.stops);
    const routes = (Array.isArray(routesResp?.routes) ? routesResp.routes : []).map((r) => ({
      code: String(r?.route_code || "").trim(),
      name: String(r?.route_name || "").trim(),
    })).filter((r) => r.code || r.name);
    return {
      ...FALLBACK_DATA.myciti,
      stops: stops.length ? stops : FALLBACK_DATA.myciti.stops,
      routes: routes.length ? routes : undefined,
      passPrices: buildMycitiPassPrices(pricesResp?.globalProducts, FALLBACK_DATA.myciti.passPrices),
      meta: {
        source: "api",
        datasetPath: "/api/routes/stops + /api/prices + /api/routes",
        lastUpdated: new Date().toISOString(),
        fallbackUsed: false,
      },
    };
  }

  async function loadGoldenArrowFromApi() {
    if (!hasApiDataClient()) throw new Error("API client unavailable");
    const [pricesResp] = await Promise.all([
      window.CCApi.getPrices({ operator: "Golden Arrow" }),
    ]);
    return {
      products: buildGaProducts(pricesResp?.globalProducts, FALLBACK_DATA.ga.products),
      routePairs: buildGaRoutePairs(pricesResp?.routePrices, FALLBACK_DATA.ga.routePairs),
      meta: {
        source: "api",
        datasetPath: "/api/prices",
        lastUpdated: new Date().toISOString(),
        fallbackUsed: false,
      },
    };
  }

  async function loadMyciti() {
    if (cache.myciti) return cache.myciti;
    try {
      cache.myciti = await loadMycitiFromApi();
    } catch (_apiErr) {
      cache.myciti = await loadJson("data/myciti.json");
    }
    return cache.myciti;
  }

  async function loadGoldenArrow() {
    if (cache.ga) return cache.ga;
    try {
      cache.ga = await loadGoldenArrowFromApi();
    } catch (_apiErr) {
      cache.ga = await loadJson("data/golden-arrow.json");
    }
    return cache.ga;
  }

  async function loadByBus(bus) {
    const normalized = String(bus || "").toLowerCase();
    if (normalized === "ga" || normalized === "goldenarrow" || normalized === "golden-arrow") {
      return loadGoldenArrow();
    }
    return loadMyciti();
  }

  function withMeta(dataset, defaults) {
    return {
      ...defaults,
      ...dataset,
      meta: {
        source: dataset?.meta?.source || "local-json",
        datasetPath: dataset?.meta?.datasetPath || "",
        lastUpdated: dataset?.meta?.lastUpdated || new Date().toISOString(),
        fallbackUsed: Boolean(dataset?.meta?.fallbackUsed),
        notes: dataset?.meta?.notes || ""
      }
    };
  }

  async function loadMycitiWithMeta() {
    try {
      const data = await loadMyciti();
      return withMeta(
        {
          ...data,
          meta: {
            source: data?.meta?.source || "local-json",
            datasetPath: data?.meta?.datasetPath || "data/myciti.json",
            lastUpdated: data?.meta?.lastUpdated || new Date().toISOString(),
            fallbackUsed: false
          }
        },
        FALLBACK_DATA.myciti
      );
    } catch (_err) {
      return withMeta(
        {
          ...FALLBACK_DATA.myciti,
          meta: {
            source: "fallback-inline",
            datasetPath: "js/data-service.js",
            lastUpdated: new Date().toISOString(),
            fallbackUsed: true
          }
        },
        FALLBACK_DATA.myciti
      );
    }
  }

  async function loadGoldenArrowWithMeta() {
    try {
      const data = await loadGoldenArrow();
      return withMeta(
        {
          ...data,
          meta: {
            source: data?.meta?.source || "local-json",
            datasetPath: data?.meta?.datasetPath || "data/golden-arrow.json",
            lastUpdated: data?.meta?.lastUpdated || new Date().toISOString(),
            fallbackUsed: false
          }
        },
        FALLBACK_DATA.ga
      );
    } catch (_err) {
      return withMeta(
        {
          ...FALLBACK_DATA.ga,
          meta: {
            source: "fallback-inline",
            datasetPath: "js/data-service.js",
            lastUpdated: new Date().toISOString(),
            fallbackUsed: true
          }
        },
        FALLBACK_DATA.ga
      );
    }
  }

  async function loadByBusWithMeta(bus) {
    const normalized = String(bus || "").toLowerCase();
    if (normalized === "ga" || normalized === "goldenarrow" || normalized === "golden-arrow") {
      return loadGoldenArrowWithMeta();
    }
    return loadMycitiWithMeta();
  }

  window.CCDataService = {
    loadMyciti,
    loadGoldenArrow,
    loadByBus,
    loadMycitiWithMeta,
    loadGoldenArrowWithMeta,
    loadByBusWithMeta
  };
})();
