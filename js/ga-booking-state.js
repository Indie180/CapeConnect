(function () {
  const KEY = "gaBooking";

  const FALLBACK = {
    products: {
      ride5: { label: "5-Ride Ticket", journeys: 5 },
      weekly: { label: "Weekly Ticket", journeys: 10 },
      monthly: { label: "Monthly Ticket", journeys: 48 }
    },
    routePairs: [
      { from: "Cape Town", to: "Khayelitsha", faresCents: { ride5: 12650, weekly: 23400, monthly: 103000 } },
      { from: "Langa", to: "Cape Town", faresCents: { ride5: 11450, weekly: 21200, monthly: 93300 } },
      { from: "Somerset West", to: "Cape Town", faresCents: { ride5: 14750, weekly: 27350, monthly: 120300 } }
    ]
  };

  const FARE_ORDER = ["ride5", "weekly", "monthly"];
  const LEGACY_TO_DATA_KEY = { ride5: "five", weekly: "weekly", monthly: "monthly", five: "five" };

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (_err) {
      return {};
    }
  }

  function writeState(next) {
    localStorage.setItem(KEY, JSON.stringify(next || {}));
  }

  function patchState(patch) {
    const merged = { ...readState(), ...(patch || {}), updatedAt: new Date().toISOString() };
    writeState(merged);
    return merged;
  }

  function clearState() {
    localStorage.removeItem(KEY);
  }

  function formatZar(cents) {
    const value = Number(cents || 0) / 100;
    return `R${value.toFixed(2)}`;
  }

  async function loadDataset() {
    if (window.CCDataService && typeof window.CCDataService.loadGoldenArrowWithMeta === "function") {
      try {
        const payload = await window.CCDataService.loadGoldenArrowWithMeta();
        return normalizeDataset(payload);
      } catch (_dsErr) {
        // Fallback to direct file load below.
      }
    }
    try {
      const res = await fetch("data/golden-arrow.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return normalizeDataset(payload);
    } catch (_err) {
      return normalizeDataset(FALLBACK);
    }
  }

  function normalizeDataset(raw) {
    const sourceProducts = raw && typeof raw.products === "object" ? raw.products : FALLBACK.products;
    const products = {};
    FARE_ORDER.forEach((key) => {
      const sourceKey = key === "ride5" ? (sourceProducts.five ? "five" : key) : key;
      const row = sourceProducts[sourceKey] || {};
      const label = row.label || FALLBACK.products[key].label;
      const journeys = Number(row.journeysIncluded || row.journeys || FALLBACK.products[key].journeys);
      products[key] = { label, journeys };
    });

    const pairs = Array.isArray(raw?.routePairs) && raw.routePairs.length ? raw.routePairs : FALLBACK.routePairs;
    const routePairs = pairs
      .map((pair) => {
        const fares = {};
        FARE_ORDER.forEach((fare) => {
          const dataKey = LEGACY_TO_DATA_KEY[fare];
          const cents = Number((pair.faresCents || {})[dataKey] || (pair.faresCents || {})[fare] || 0);
          fares[fare] = cents;
        });
        return {
          from: String(pair.from || "").trim(),
          to: String(pair.to || "").trim(),
          faresCents: fares
        };
      })
      .filter((pair) => pair.from && pair.to);

    return { products, routePairs };
  }

  function priceRanges(dataset) {
    const output = {};
    FARE_ORDER.forEach((fare) => {
      const values = (dataset.routePairs || [])
        .map((pair) => Number((pair.faresCents || {})[fare] || 0))
        .filter((v) => v > 0);
      if (!values.length) {
        output[fare] = "-";
        return;
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      output[fare] = min === max ? formatZar(min) : `${formatZar(min)} - ${formatZar(max)}`;
    });
    return output;
  }

  function stopsFromPairs(dataset) {
    const names = [];
    (dataset.routePairs || []).forEach((pair) => {
      names.push(pair.from);
      names.push(pair.to);
    });
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }

  function getRouteFare(dataset, from, to, fare) {
    const match = (dataset.routePairs || []).find((pair) => pair.from === from && pair.to === to);
    if (!match) return null;
    const cents = Number((match.faresCents || {})[fare] || 0);
    return cents > 0 ? cents : null;
  }

  function fareLabel(dataset, fare) {
    return dataset.products?.[fare]?.label || FALLBACK.products[fare]?.label || "Ticket";
  }

  function fareJourneys(dataset, fare) {
    return Number(dataset.products?.[fare]?.journeys || FALLBACK.products[fare]?.journeys || 0);
  }

  function recommendFare(dataset, plannedTrips, quantity) {
    const trips = Math.max(1, Number(plannedTrips || 1));
    const qty = Math.max(1, Number(quantity || 1));
    const scores = FARE_ORDER.map((fare) => {
      const cap = fareJourneys(dataset, fare) * qty;
      const deficit = cap - trips;
      return { fare, deficit, cap };
    }).filter((row) => row.cap > 0);

    const positive = scores.filter((s) => s.deficit >= 0).sort((a, b) => a.deficit - b.deficit);
    if (positive.length) return positive[0].fare;
    return scores.sort((a, b) => b.cap - a.cap)[0]?.fare || "monthly";
  }

  window.GABookingState = {
    KEY,
    fares: FARE_ORDER,
    readState,
    writeState,
    patchState,
    clearState,
    loadDataset,
    priceRanges,
    stopsFromPairs,
    getRouteFare,
    fareLabel,
    fareJourneys,
    recommendFare,
    formatZar
  };
})();
