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

# OSRM public demo server rate-limit is ~1 req/s; be respectful.
REQUEST_TIMEOUT_SEC = 15
OSRM_REQUEST_DELAY_SEC = 1.0   # polite delay between calls

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


class RoutingError(RouteServiceError):
    """Raised when the routing API returns no usable routes."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _http_get(url: str, headers: Optional[dict] = None) -> dict:
    """
    Perform a simple HTTP GET and return the parsed JSON body.
    Raises RouteServiceError on any network or HTTP error.
    """
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        raise RouteServiceError(
            f"HTTP {exc.code} from {url}: {exc.reason}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RouteServiceError(
            f"Network error reaching {url}: {exc.reason}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise RouteServiceError(
            f"Invalid JSON response from {url}"
        ) from exc


def _geocode(place_name: str) -> tuple[float, float]:
    """
    Convert a place name to (latitude, longitude) using Nominatim.

    Returns the first result's coordinates.

    Geocoding strategy (two attempts):
      1. Query exactly as provided by the user.
      2. If attempt 1 returns no results, retry with ', India' appended.
         This handles "Guwahati, Assam" (works as-is) as well as cases where
         adding the country name improves Nominatim's match.

    Raises GeocodingError only when BOTH attempts fail — this surfaces a
    clear, accurate error rather than silently returning wrong coordinates.
    """
    def _query(q: str):
        params = urllib.parse.urlencode({
            "q":      q,
            "format": "json",
            "limit":  1,
        })
        url = f"{NOMINATIM_URL}?{params}"
        log.info("Geocoding: %r", q)
        return _http_get(url, headers={"User-Agent": "MARG-SIH-RouteService/1.0"})

    # Attempt 1: user's original input
    data = _query(place_name)

    # Attempt 2: append ', India' to help Nominatim narrow the region
    if not data and not place_name.lower().strip().endswith("india"):
        india_query = place_name.strip().rstrip(",") + ", India"
        log.info("Retrying geocoding with country suffix: %r", india_query)
        time.sleep(1.0)  # polite delay between Nominatim requests
        data = _query(india_query)

    if not data:
        raise GeocodingError(
            f"No geocoding result for '{place_name}'. "
            "Check spelling — e.g. 'Guwahati, Assam' or 'Silchar, Assam'."
        )

    lat = float(data[0]["lat"])
    lon = float(data[0]["lon"])
    log.info("  → %.6f, %.6f", lat, lon)
    return lat, lon



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
    list[dict]  – List of route objects conforming to the team contract:
        [
          {
            "route_id":           "R1",
            "origin":             "Guwahati",
            "destination":        "Silchar",
            "route_name":         "Route 1",
            "distance_km":        180.0,
            "estimated_time_min": 240.0,
            "coordinates":        [{"lat": ..., "lon": ...}, ...]
          },
          ...
        ]

    Raises
    ------
    GeocodingError   – If origin or destination cannot be geocoded.
    RoutingError     – If the routing API returns no usable routes.
    RouteServiceError – On network / HTTP errors.
    """
    # ---- 0. Mock mode (offline dev only) -----------------------------------
    if MOCK_MODE:
        routes = _mock_routes(origin, destination)
        _validate_routes(routes)
        return routes

    # ---- 1. Geocode --------------------------------------------------------
    orig_lat, orig_lon = _geocode(origin)
    # Polite delay between Nominatim requests
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
