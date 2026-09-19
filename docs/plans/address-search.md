# Plan: address search (Sprint 4, F3)

Owner: Jackson (workstream B). Status: in progress on `work/address-search` (PR into `test`).
Follows the project rule: plan first, docs in the same PR.

## Why

The business idea in the pitch is "is this a good spot?", and a person thinks in street addresses, not
Census block group IDs. The top search box only matches area names; it currently says "Address search is
coming next." Typing an address should drop a pin, zoom there, and select the Census block group that
contains it, so all the existing evidence (counts, sources, planning passages, storefronts) applies.

## Behavior

- Type in the existing search box. Area-name matches work as before. For anything else, or by choosing the
  "Search address" row, the address is sent to the OpenStreetMap **Nominatim** geocoder.
- Results (up to 5, limited to the map's coverage box and the US) appear in the dropdown. Choosing one drops a
  labeled pin, zooms to it, and selects the containing block group (block group preferred over the CDP).
- An address outside the covered area still gets a pin, with a note that no area was selected.
- Clear states for searching, no result, and service unavailable. XSS-safe: labels are text only.

## Nominatim usage rules this design follows

- **No search-as-you-type.** Requests are sent only on Enter or by choosing the row (autocomplete is not allowed).
- **At most 1 request per second.** Requests are serialized and spaced at least 1.1 s apart.
- **Cache** results per query in memory, so a repeat search sends nothing.
- **Attribution:** the dropdown credits OpenStreetMap contributors; the map already carries the basemap credit.
- **Identification:** a browser cannot set a custom User-Agent; the browser's Referer identifies the app. If this
  ever leaves demo scale, proxy through the backend with a real User-Agent and shared rate limiting.
- **Privacy:** the typed text is sent to OpenStreetMap's servers. The dropdown says so before the user sends it.

## Files

- `frontend/src/lib/geocode.ts` (query, throttle, cache, response validation)
- `frontend/src/lib/geo.ts` (point-in-polygon, containing area, coverage box)
- `frontend/src/map/CommunityMap.tsx` (address pin, non-animated zoom)
- `frontend/src/App.tsx` (search box flow), `frontend/src/style.css`
- `frontend/tests/address-search.spec.ts` (Nominatim mocked; no real network in tests)

## Known limits

- Coverage is the map's bounding box, so a point inside the box but in no block group gets a pin and no selection.
- Nominatim results depend on OpenStreetMap address data; some valid addresses will not resolve.
- The public Nominatim service has no uptime guarantee; the UI shows an error state and keeps working.

## Validation

`npm run build`; `npx playwright test` against the real backend, with Nominatim mocked in the new tests.
