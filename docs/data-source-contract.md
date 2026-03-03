# CapeConnect Data Source Contract (Frontend Phase)

Last reviewed: 2026-02-16
Scope: MyCiTi and Golden Arrow data used by frontend JSON datasets.

## 1) Source Authority Rules

- Only official operator/government channels may be used as source-of-truth.
- News sites and social posts can be used only as alerts, never as final data input.
- Each dataset publish must include:
  - `sourceUrl`
  - `sourceType` (fare release, timetable page, product table)
  - `effectiveDate`
  - `retrievedAt`
  - `reviewedBy`

## 2) Approved Official Sources

### MyCiTi (City of Cape Town)

- Official site root:
  - https://www.myciti.org.za/
- Timetable downloads:
  - https://www.myciti.org.za/en/timetables/timetable-downloads/
- Route/stop timetables:
  - https://www.myciti.org.za/en/timetables/route-stop-station-timetables/
- Fare announcements (effective-dated):
  - https://www.myciti.org.za/en/contact/media-releases/annual-fare-adjustment-july-2025/

### Golden Arrow (GABS)

- Official site root:
  - https://www.gabs.co.za/
- Routes and times:
  - https://www.gabs.co.za/RouteandTimes.aspx
- Gold Card product/fare details:
  - https://www.gabs.co.za/ProductDetails.aspx
- Official contact for timetable/fare confirmation:
  - https://www.gabs.co.za/ContactUs.aspx

## 3) Frontend Dataset Mapping

- `data/myciti.json`
  - `stops` <- MyCiTi timetable/route-stop sources
  - `routes` <- MyCiTi timetable downloads
  - `passPrices` and `moverFareBands` <- MyCiTi fare release page
- `data/golden-arrow.json`
  - `products` <- GABS ProductDetails page
  - `routePairs` + fare values <- GABS ProductDetails page (or official fare export when available)

## 4) Publish Gate (Must Pass)

- Effective date is present and not ambiguous.
- Currency and units are normalized:
  - all persisted fares in cents in generated artifacts
  - UI may render to ZAR display format
- Route/stop names deduplicated and trimmed.
- Spot-check at least 5 random fare rows per operator against source pages.
- Metadata updated (`lastUpdated`, `source`, `effectiveDate`) before release.

## 5) Escalation Rules

- If official pages conflict:
  - use the newer explicit effective date
  - log conflict in release notes
  - hold publish until verified via official contact email/phone.
- If official page is unavailable:
  - keep current production dataset
  - mark status as `stale`
  - do not silently fall back to news/media values.

