const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const NodeCache = require("node-cache");

const app = express();
app.use(cors());
app.use(morgan("dev"));

const cache = new NodeCache({ stdTTL: 60 * 60 }); // 1 hour cache

// Western Cape Government ArcGIS MapServer for Transportation datasets
// Golden Arrow Bus Routes = layer 5
// Golden Arrow Bus Stops  = layer 6
const WCG_ARCGIS_BASE =
  "https://gis.westerncape.gov.za/server2/rest/services/SpatialDataWarehouse/Transportation/MapServer";

const LAYERS = {
  routes: 5,
  stops: 6,
};

// Generic ArcGIS layer fetcher with pagination
async function fetchAllFeatures(
  layerId,
  { where = "1=1", outFields = "*", outSR = undefined } = {}
) {
  const pageSize = 2000; // MaxRecordCount for these layers is 2000
  let offset = 0;
  let all = [];

  while (true) {
    const url = `${WCG_ARCGIS_BASE}/${layerId}/query`;
    const params = {
      where,
      outFields,
      f: "pjson",
      returnGeometry: true,
      resultRecordCount: pageSize,
      resultOffset: offset,
    };
    if (outSR) params.outSR = outSR;

    const { data } = await axios.get(url, { params, timeout: 30000 });

    const features = data?.features || [];
    all = all.concat(features);

    // When exceededTransferLimit = true, there is more data to fetch
    const exceeded = data?.exceededTransferLimit === true;

    if (!exceeded || features.length === 0) break;
    offset += pageSize;
  }

  return all;
}

function utmToLatLonWgs84(easting, northing, zone, southernHemisphere = true) {
  const a = 6378137.0;
  const eccSquared = 0.00669437999014;
  const k0 = 0.9996;

  const x = Number(easting) - 500000.0;
  let y = Number(northing);
  if (southernHemisphere) y -= 10000000.0;

  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);

  const M = y / k0;
  const mu =
    M /
    (a *
      (1 -
        eccSquared / 4 -
        (3 * eccSquared * eccSquared) / 64 -
        (5 * eccSquared * eccSquared * eccSquared) / 256));

  const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu) +
    ((1097 * Math.pow(e1, 4)) / 512) * Math.sin(8 * mu);

  const N1 = a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad));
  const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
  const C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
  const R1 =
    (a * (1 - eccSquared)) /
    Math.pow(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
  const D = x / (N1 * k0);

  let lat =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      (D * D / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) *
          Math.pow(D, 4)) /
          24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) *
          Math.pow(D, 6)) /
          720);
  lat = (lat * 180) / Math.PI;

  let lon =
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) *
        Math.pow(D, 5)) /
        120) /
    Math.cos(phi1Rad);
  lon = longOrigin + (lon * 180) / Math.PI;

  return { lat, lon };
}

function normalizePointToWgs84(geometry) {
  const x = Number(geometry?.x);
  const y = Number(geometry?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { lat: null, lon: null };

  // ArcGIS WGS84 point expected as x=lon, y=lat
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    return { lon: x, lat: y };
  }

  // Occasionally data can come as x=lat, y=lon
  if (Math.abs(x) <= 90 && Math.abs(y) <= 180) {
    return { lon: y, lat: x };
  }

  // Fallback for common local projection in UTM 34S
  if (x > 100000 && x < 1000000 && y > 1000000 && y < 10000000) {
    return utmToLatLonWgs84(x, y, 34, true);
  }

  return { lat: null, lon: null };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getStopsData() {
  const cacheKey = "gabs_stops";
  const cached = cache.get(cacheKey);
  if (cached) return { source: "cache", data: cached };

  // Request in WGS84 first; conversion fallback handles non-WGS84 geometries.
  const features = await fetchAllFeatures(LAYERS.stops, { outSR: 4326 });

  const stops = features.map((f) => {
    const point = normalizePointToWgs84(f.geometry);
    return {
      id: f.attributes.OBJECTID ?? f.attributes.ObjectId ?? null,
      routeName: f.attributes.ROUTENAME ?? f.attributes.Route_name ?? null,
      stopName:
        f.attributes.STOPNAME ??
        f.attributes.StopName ??
        f.attributes.BUSSTOPDES ??
        null,
      busStopNo: f.attributes.BUSSTOPNO ?? null,
      busStopDescription: f.attributes.BUSSTOPDES ?? null,
      x: f.geometry?.x ?? null,
      y: f.geometry?.y ?? null,
      lat: point.lat,
      lon: point.lon,
      attributes: f.attributes,
    };
  });

  cache.set(cacheKey, stops);
  return { source: "wcg_arcgis", data: stops };
}

// Health check
app.get("/", (_req, res) => res.send("Golden Arrow API running"));

// GET /gabs/routes
app.get("/gabs/routes", async (_req, res) => {
  try {
    const cacheKey = "gabs_routes";
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ source: "cache", count: cached.length, data: cached });

    const features = await fetchAllFeatures(LAYERS.routes);

    // NOTE: attribute names vary by dataset; keep attributes raw + add a few common fields when present
    const routes = features.map((f) => ({
      id: f.attributes.OBJECTID ?? f.attributes.ObjectId ?? null,
      name:
        f.attributes.Route_name ??
        f.attributes.ROUTENAME ??
        f.attributes.RouteName ??
        null,
      attributes: f.attributes,
      geometry: f.geometry, // polyline
    }));

    cache.set(cacheKey, routes);
    res.json({ source: "wcg_arcgis", count: routes.length, data: routes });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch Golden Arrow routes",
      details: err.message,
    });
  }
});

// GET /gabs/stops
app.get("/gabs/stops", async (_req, res) => {
  try {
    const result = await getStopsData();
    res.json({ source: result.source, count: result.data.length, data: result.data });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch Golden Arrow stops",
      details: err.message,
    });
  }
});

// GET /gabs/stops/search?q=wynberg
app.get("/gabs/stops/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));

    if (!q) {
      return res.status(400).json({ error: "Missing query parameter: q" });
    }

    const result = await getStopsData();
    const filtered = result.data
      .filter((stop) => {
        const text = [
          stop.stopName,
          stop.routeName,
          stop.busStopNo,
          stop.busStopDescription,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      })
      .slice(0, limit);

    res.json({
      source: result.source,
      query: q,
      count: filtered.length,
      data: filtered,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to search Golden Arrow stops",
      details: err.message,
    });
  }
});

// GET /gabs/stops/near?lat=-33.925&lon=18.424&km=1
app.get("/gabs/stops/near", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const km = Math.max(0.1, Math.min(100, Number(req.query.km || 1)));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res
        .status(400)
        .json({ error: "Missing or invalid query params: lat, lon (decimal degrees)" });
    }

    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return res.status(400).json({ error: "lat/lon out of range" });
    }

    const result = await getStopsData();

    const nearby = result.data
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lon))
      .map((stop) => {
        const distanceKm = haversineKm(lat, lon, stop.lat, stop.lon);
        return { ...stop, distanceKm: Number(distanceKm.toFixed(4)) };
      })
      .filter((stop) => stop.distanceKm <= km)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    res.json({
      source: result.source,
      center: { lat, lon },
      radiusKm: km,
      count: nearby.length,
      data: nearby,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to find nearby Golden Arrow stops",
      details: err.message,
    });
  }
});

// GET /gabs/fares  (official PDFs)
app.get("/gabs/fares", (_req, res) => {
  res.json({
    official_sources: {
      multi_journey_fares_pdf:
        "https://www.gabs.co.za/Assets/resources/2024_09_24_Multi_Journey_Fares.pdf",
      product_details_pdf:
        "https://www.gabs.co.za/Assets/resources/2024_09_24_Product_Details.pdf",
      fares_increase_media_release_pdf:
        "https://www.gabs.co.za/Assets/press/pressreleases/MEDIA%20RELEASE%202401_Fares%20increase%2001%20April%202024.pdf",
    },
    note:
      "Next step: parse the fares PDF into JSON so your API can return fare tables directly.",
  });
});

// GET /gabs/timetables  (official entry page)
app.get("/gabs/timetables", (_req, res) => {
  res.json({
    official_timetables_entry: "https://www.gabs.co.za/Timetable.aspx",
    note:
      "Next step: scrape the timetable list / route dropdown and return downloadable links per route.",
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`GABS API running on http://localhost:${PORT}`));
