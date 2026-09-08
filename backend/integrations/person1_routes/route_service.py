"""
route_service.py
----------------
MARG Smart India Hackathon — Person 1 (Route Generation)

Responsibilities:
  - Geocode origin/destination via Nominatim (OpenStreetMap)
  - Fetch routes via OSRM public API (OpenStreetMap routing)
  - Return standardised route objects matching the team contract

Output contract:
[
  {
    "route_id":           "R1",
    "origin":             "Guwahati",
    "destination":        "Silchar",
    "route_name":         "Route 1",
    "distance_km":        180,
    "estimated_time_min": 240,
    "coordinates": [{"lat": 26.1445, "lon": 91.7362}, ...]
  }
]

GEOCODING RESILIENCE (added for demo reliability):
  1. In-memory cache — successful geocodes are cached for the process lifetime.
  2. Demo-safe fallback coordinates — hardcoded for common NE India locations
     so that repeated demo queries never hit Nominatim unnecessarily.
  3. Retry with exponential backoff — handles transient 429 / 5xx errors.
  4. Descriptive User-Agent and clear error differentiation.
"""

import os
import json
import time
import logging
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"

REQUEST_TIMEOUT_SEC = 15
OSRM_REQUEST_DELAY_SEC = 1.0   # polite delay between OSRM calls

# Maximum Nominatim retries for transient errors (429 / 5xx / timeout)
NOMINATIM_MAX_RETRIES = 3
# Base backoff in seconds (doubles on each retry: 1s, 2s, 4s)
NOMINATIM_BACKOFF_BASE = 1.0

# Set env var ROUTE_MOCK=1 to force mock mode (useful when offline).
MOCK_MODE = os.environ.get("ROUTE_MOCK", "0").strip() == "1"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [route_service] %(levelname)s: %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class RouteServiceError(Exception):
    """Base error for all route-service failures."""


class GeocodingError(RouteServiceError):
    """Raised when a place name cannot be geocoded."""


class GeocodingRateLimitError(GeocodingError):
    """Raised when Nominatim is temporarily rate-limiting us (429)."""


class RoutingError(RouteServiceError):
    """Raised when the routing API returns no usable routes."""


# ---------------------------------------------------------------------------
# Demo-safe fallback coordinates
# ---------------------------------------------------------------------------
# Purpose: Prevent unnecessary Nominatim calls for commonly tested NE India
# locations during SIH demos. These are NOT a replacement for live geocoding —
# any location NOT in this dictionary still goes through Nominatim normally.
#
# Source: Verified via Nominatim / OpenStreetMap.
# Format: lowercase normalised key → (latitude, longitude)

_DEMO_FALLBACK_COORDS: dict[str, tuple[float, float]] = {
    # ── Assam ──────────────────────────────────────────────────────────────
    "guwahati":                 (26.180598,  91.753943),
    "guwahati, assam":          (26.180598,  91.753943),
    "silchar":                  (24.827403,  92.797942),
    "silchar, assam":           (24.827403,  92.797942),
    "tezpur":                   (26.622993,  92.797608),
    "tezpur, assam":            (26.622993,  92.797608),
    "jorhat":                   (26.757526,  94.203470),
    "jorhat, assam":            (26.757526,  94.203470),
    "dibrugarh":                (27.480920,  94.903130),
    "dibrugarh, assam":         (27.480920,  94.903130),
    "nagaon":                   (26.344980,  92.688290),
    "nagaon, assam":            (26.344980,  92.688290),
    "bongaigaon":               (26.481530,  90.560020),
    "bongaigaon, assam":        (26.481530,  90.560020),
    "haflong":                  (25.168990,  93.020640),
    "haflong, assam":           (25.168990,  93.020640),
    "diphu":                    (25.837530,  93.435830),
    "diphu, assam":             (25.837530,  93.435830),
    # ── Meghalaya ──────────────────────────────────────────────────────────
    "shillong":                 (25.578773,  91.893253),
    "shillong, meghalaya":      (25.578773,  91.893253),
    "tura":                     (25.514400,  90.213800),
    "tura, meghalaya":          (25.514400,  90.213800),
    # ── Manipur ────────────────────────────────────────────────────────────
    "imphal":                   (24.817000,  93.937000),
    "imphal, manipur":          (24.817000,  93.937000),
    "churachandpur":            (24.332900,  93.683500),
    "churachandpur, manipur":   (24.332900,  93.683500),
    # ── Tripura ────────────────────────────────────────────────────────────
    "agartala":                 (23.831457,  91.286778),
    "agartala, tripura":        (23.831457,  91.286778),
    # ── Mizoram ────────────────────────────────────────────────────────────
    "aizawl":                   (23.727111,  92.717636),
    "aizawl, mizoram":          (23.727111,  92.717636),
    "lunglei":                  (22.888100,  92.735400),
    "lunglei, mizoram":         (22.888100,  92.735400),
    # ── Nagaland ───────────────────────────────────────────────────────────
    "kohima":                   (25.674270,  94.111290),
    "kohima, nagaland":         (25.674270,  94.111290),
    "dimapur":                  (25.906990,  93.726220),
    "dimapur, nagaland":        (25.906990,  93.726220),
    # ── Arunachal Pradesh ──────────────────────────────────────────────────
    "itanagar":                 (27.084770,  93.606870),
    "itanagar, arunachal pradesh": (27.084770, 93.606870),
    "pasighat":                 (28.066400,  95.323900),
    "pasighat, arunachal pradesh": (28.066400, 95.323900),
    # ── Sikkim ─────────────────────────────────────────────────────────────
    "gangtok":                  (27.329231,  88.612179),
    "gangtok, sikkim":          (27.329231,  88.612179),
}


# ---------------------------------------------------------------------------
# In-memory geocoding cache
# ---------------------------------------------------------------------------
# Stores results of successful Nominatim lookups for the process lifetime.
# Key: normalised (lowercase, stripped) location string.
# Value: (latitude, longitude) tuple.
# Demo-fallback hits are also stored here to unify the lookup path.

_GEOCODE_CACHE: dict[str, tuple[float, float]] = {}


def _cache_key(place_name: str) -> str:
    """Normalise a place name to a consistent cache key."""
    return place_name.strip().lower()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _http_get_with_retry(
    url: str,
    headers: Optional[dict] = None,
    max_retries: int = NOMINATIM_MAX_RETRIES,
    backoff_base: float = NOMINATIM_BACKOFF_BASE,
) -> dict | list:
    """
    Perform an HTTP GET with exponential backoff retry for transient errors.

    Retries on:
      - HTTP 429 Too Many Requests
      - HTTP 5xx Server errors
      - Network/timeout errors

    Does NOT retry on:
      - HTTP 4xx client errors (except 429), e.g. 404 Not Found
    """
    req = urllib.request.Request(url, headers=headers or {})
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body)

        except urllib.error.HTTPError as exc:
            last_exc = exc
            status = exc.code

            # Rate limited — wait longer and retry
            if status == 429:
                wait = backoff_base * (2 ** (attempt - 1))
                log.warning(
                    "Nominatim rate limit (429) on attempt %d/%d. "
                    "Waiting %.1fs before retry.",
                    attempt, max_retries, wait,
                )
                if attempt < max_retries:
                    time.sleep(wait)
                    continue
                # All retries exhausted on 429
                raise GeocodingRateLimitError(
                    "Location service is temporarily busy (rate limited). "
                    "Please try again in a moment."
                ) from exc

            # Server error — retry
            if 500 <= status < 600:
                wait = backoff_base * (2 ** (attempt - 1))
                log.warning(
                    "HTTP %d server error on attempt %d/%d. "
                    "Waiting %.1fs before retry.",
                    status, attempt, max_retries, wait,
                )
                if attempt < max_retries:
                    time.sleep(wait)
                    continue
                raise RouteServiceError(
                    f"HTTP {status} from {url}: {exc.reason}"
                ) from exc

            # Other 4xx — not retryable
            raise RouteServiceError(
                f"HTTP {status} from {url}: {exc.reason}"
            ) from exc

        except urllib.error.URLError as exc:
            last_exc = exc
            wait = backoff_base * (2 ** (attempt - 1))
            log.warning(
                "Network error on attempt %d/%d: %s. Waiting %.1fs.",
                attempt, max_retries, exc.reason, wait,
            )
            if attempt < max_retries:
                time.sleep(wait)
                continue
            raise RouteServiceError(
                f"Network error reaching {url}: {exc.reason}"
            ) from exc

        except json.JSONDecodeError as exc:
            raise RouteServiceError(
                f"Invalid JSON response from {url}"
            ) from exc

    # Should not reach here, but belt-and-suspenders
    raise RouteServiceError(
        f"All {max_retries} attempts failed for {url}. Last error: {last_exc}"
    )


def _http_get(url: str, headers: Optional[dict] = None) -> dict | list:
    """Backward-compatible wrapper around _http_get_with_retry."""
    return _http_get_with_retry(url, headers=headers)


_NOMINATIM_HEADERS = {
    "User-Agent": (
        "MARG-SIH-2024-Route-Accessibility-Project/1.0 "
        "(Smart India Hackathon; emergency logistics; contact: marg-sih@example.com)"
    ),
    "Accept-Language": "en",
    "Accept": "application/json",
}


def _geocode(place_name: str) -> tuple[float, float]:
    """
    Convert a place name to (latitude, longitude).

    Lookup order:
      1. In-memory cache  — instant, no network call.
      2. Demo-safe fallback dictionary — instant, no network call.
         Covers common Northeast India locations for reliable demo operation.
      3. Nominatim live query — with retry/backoff and polite delays.

    Raises:
      GeocodingRateLimitError – if Nominatim is temporarily rate-limiting.
      GeocodingError          – if the location cannot be found.
    """
    key = _cache_key(place_name)

    # ── 1. Cache hit ─────────────────────────────────────────────────────────
    if key in _GEOCODE_CACHE:
        lat, lon = _GEOCODE_CACHE[key]
        log.info("Geocoding cache hit: %r → %.6f, %.6f", place_name, lat, lon)
        return lat, lon

    # ── 2. Demo-safe fallback dictionary ─────────────────────────────────────
    if key in _DEMO_FALLBACK_COORDS:
        lat, lon = _DEMO_FALLBACK_COORDS[key]
        log.info(
            "Geocoding demo fallback: %r → %.6f, %.6f (no Nominatim call)",
            place_name, lat, lon,
        )
        # Populate cache so subsequent calls are also instant
        _GEOCODE_CACHE[key] = (lat, lon)
        return lat, lon

    # ── 3. Live Nominatim query ───────────────────────────────────────────────
    def _query_nominatim(q: str) -> list:
        params = urllib.parse.urlencode({
            "q":      q,
            "format": "json",
            "limit":  1,
        })
        url = f"{NOMINATIM_URL}?{params}"
        log.info("Geocoding via Nominatim: %r", q)
        return _http_get_with_retry(url, headers=_NOMINATIM_HEADERS)

    # Attempt 1: user's original input
    data = _query_nominatim(place_name)

    # Attempt 2: append ', India' if no result and not already India-suffixed
    if not data and not key.endswith("india"):
        india_query = place_name.strip().rstrip(",") + ", India"
        log.info("Retrying geocoding with country suffix: %r", india_query)
        time.sleep(1.0)   # polite delay between Nominatim requests
        data = _query_nominatim(india_query)

    if not data:
        raise GeocodingError(
            f"Location could not be found: '{place_name}'. "
            "Please check the spelling and try again — e.g. 'Guwahati, Assam'."
        )

    lat = float(data[0]["lat"])
    lon = float(data[0]["lon"])
    log.info("  → %.6f, %.6f (Nominatim)", lat, lon)

    # Cache successful result
    _GEOCODE_CACHE[key] = (lat, lon)
    return lat, lon


# ---------------------------------------------------------------------------
# Geometry decoding
# ---------------------------------------------------------------------------

def _decode_geometry(geometry: dict) -> list[dict]:
    """
    Convert a GeoJSON LineString geometry (OSRM 'geojson' format) to
    a list of {"lat": ..., "lon": ...} dicts — matching the team contract.

    OSRM returns [lon, lat] inside GeoJSON; we swap to lat-first.
    """
    if geometry.get("type") != "LineString":
        return []
    return [{"lat": pt[1], "lon": pt[0]} for pt in geometry["coordinates"]]


def _build_route_object(
    index: int, leg: dict, geometry: dict,
    origin: str, destination: str
) -> dict:
    """
    Convert a single OSRM route into the team's standardised contract object.
    """
    distance_m = leg.get("distance", 0)
    duration_s = leg.get("duration", 0)

    route_id = f"R{index}"
    return {
        "route_id": route_id,
        "origin": origin,
        "destination": destination,
        "route_name": f"Route {index}",
        "distance_km": round(distance_m / 1000, 2),
        "estimated_time_min": round(duration_s / 60, 1),
        "coordinates": _decode_geometry(geometry),
    }


# ---------------------------------------------------------------------------
# Mock / fallback (offline development only)
# ---------------------------------------------------------------------------

def _mock_routes(origin: str, destination: str) -> list[dict]:
    """
    Return synthetic route objects when ROUTE_MOCK=1.
    Clearly labelled as mock data so they are never mistaken for real routes.
    WARNING: Do NOT use this data in production or scoring.
    """
    log.warning("MOCK MODE active — returning synthetic routes.")
    return [
        {
            "route_id": "R1",
            "origin": origin,
            "destination": destination,
            "route_name": "Route 1 [MOCK]",
            "distance_km": 999.0,
            "estimated_time_min": 999.0,
            "coordinates": [{"lat": 0.0, "lon": 0.0}, {"lat": 1.0, "lon": 1.0}],
        },
        {
            "route_id": "R2",
            "origin": origin,
            "destination": destination,
            "route_name": "Route 2 [MOCK]",
            "distance_km": 1111.0,
            "estimated_time_min": 1200.0,
            "coordinates": [{"lat": 0.0, "lon": 0.0}, {"lat": 0.5, "lon": 0.5}, {"lat": 1.0, "lon": 1.0}],
        },
    ]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_routes(routes: list[dict]) -> None:
    """
    Assert that every route object in the list satisfies the team contract.
    Raises ValueError with a descriptive message on the first violation.
    """
    required_keys = {"route_id", "origin", "destination", "route_name",
                     "distance_km", "estimated_time_min", "coordinates"}
    seen_ids: set[str] = set()

    for i, route in enumerate(routes):
        missing = required_keys - route.keys()
        if missing:
            raise ValueError(
                f"Route at index {i} missing required keys: {missing}"
            )

        rid = route["route_id"]
        if rid in seen_ids:
            raise ValueError(f"Duplicate route_id detected: '{rid}'")
        seen_ids.add(rid)

        if not isinstance(route["distance_km"], (int, float)):
            raise ValueError(
                f"{rid}: distance_km must be numeric, got "
                f"{type(route['distance_km']).__name__}"
            )
        if not isinstance(route["estimated_time_min"], (int, float)):
            raise ValueError(
                f"{rid}: estimated_time_min must be numeric, got "
                f"{type(route['estimated_time_min']).__name__}"
            )
        if not route["coordinates"]:
            raise ValueError(f"{rid}: coordinates list is empty")
        for coord in route["coordinates"]:
            if not isinstance(coord, dict) or "lat" not in coord or "lon" not in coord:
                raise ValueError(
                    f"{rid}: each coordinate must be {{\"lat\": number, \"lon\": number}}, got {coord}"
                )

    log.info("Validation passed for %d route(s).", len(routes))


# ---------------------------------------------------------------------------
# Public API — the only function Person 4 should call
# ---------------------------------------------------------------------------

def get_routes(origin: str, destination: str) -> list[dict]:
    """
    Fetch driving routes from *origin* to *destination*.

    Parameters
    ----------
    origin      : str  – Any place name (city, address, landmark).
    destination : str  – Any place name (city, address, landmark).

    Returns
    -------
    list[dict]  – List of route objects conforming to the team contract.

    Raises
    ------
    GeocodingError        – If origin or destination cannot be geocoded.
    GeocodingRateLimitError – If Nominatim is temporarily rate-limiting.
    RoutingError          – If the routing API returns no usable routes.
    RouteServiceError     – On unrecoverable network / HTTP errors.
    """
    # ---- 0. Mock mode (offline dev only) -----------------------------------
    if MOCK_MODE:
        routes = _mock_routes(origin, destination)
        _validate_routes(routes)
        return routes

    # ---- 1. Geocode --------------------------------------------------------
    # Cache + demo-fallback means frequently tested locations skip Nominatim.
    # Only uncached/unknown locations trigger a live network request.
    orig_lat, orig_lon = _geocode(origin)

    # Polite delay only before a live Nominatim call (not cache hits)
    origin_key = _cache_key(origin)
    dest_key = _cache_key(destination)
    # We need a delay between Nominatim calls; skip if destination is cached
    if dest_key not in _GEOCODE_CACHE and dest_key not in _DEMO_FALLBACK_COORDS:
        time.sleep(1.0)

    dest_lat, dest_lon = _geocode(destination)

    # ---- 2. Build OSRM request ---------------------------------------------
    # Format: /route/v1/driving/{lon},{lat};{lon},{lat}
    coords_str = f"{orig_lon},{orig_lat};{dest_lon},{dest_lat}"
    params = urllib.parse.urlencode({
        "alternatives": "true",   # request up to 3 alternative routes
        "geometries": "geojson",  # GeoJSON LineString per route
        "overview": "full",       # full-resolution geometry
        "steps": "false",
    })
    osrm_url = f"{OSRM_BASE_URL}/{coords_str}?{params}"
    log.info("OSRM request: %s", osrm_url)

    time.sleep(OSRM_REQUEST_DELAY_SEC)
    response = _http_get(osrm_url)

    # ---- 3. Check OSRM status ----------------------------------------------
    osrm_code = response.get("code", "")
    if osrm_code != "Ok":
        raise RoutingError(
            f"OSRM returned non-Ok status: '{osrm_code}'. "
            f"Message: {response.get('message', 'no message')}. "
            "Possible cause: no road network between the two points."
        )

    raw_routes = response.get("routes", [])
    if not raw_routes:
        raise RoutingError(
            "OSRM returned zero routes for "
            f"'{origin}' → '{destination}'."
        )

    # ---- 4. Parse + convert ------------------------------------------------
    routes: list[dict] = []
    for idx, raw in enumerate(raw_routes, start=1):
        # 'legs' is a list (one per waypoint segment); for A→B there's one leg.
        leg = raw.get("legs", [{}])[0]
        # Top-level 'distance'/'duration' are totals across all legs.
        leg_totals = {
            "distance": raw.get("distance", leg.get("distance", 0)),
            "duration": raw.get("duration", leg.get("duration", 0)),
        }
        geometry = raw.get("geometry", {"type": "LineString", "coordinates": []})
        route_obj = _build_route_object(idx, leg_totals, geometry, origin, destination)
        routes.append(route_obj)

    # ---- 5. Validate -------------------------------------------------------
    _validate_routes(routes)

    log.info(
        "Returning %d route(s) for '%s' → '%s'.",
        len(routes), origin, destination,
    )
    return routes


# ---------------------------------------------------------------------------
# CLI convenience
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python route_service.py \"<origin>\" \"<destination>\"")
        sys.exit(1)

    origin_arg = sys.argv[1]
    dest_arg = sys.argv[2]

    try:
        result = get_routes(origin_arg, dest_arg)
        print(json.dumps(result, indent=2))
    except RouteServiceError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)
