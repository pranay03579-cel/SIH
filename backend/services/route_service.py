"""
route_service.py — Person 1 Integration Point
──────────────────────────────────────────────
Responsibility: Generate multiple possible routes between an origin and
destination using an open-source map API.

CURRENT STATE: DEMO FALLBACK
    Reads from data/demo_routes.json and filters by origin+destination.
    This keeps the backend independently testable while Person 1 builds
    the real route-generation module.

HOW PERSON 1 INTEGRATES:
    Replace the body of `get_routes()` with a call to Person 1's module.

    Example (OSRM / GraphHopper / OpenRouteService):

        from person1_module import fetch_routes_from_api

        def get_routes(origin: str, destination: str) -> list[dict]:
            return fetch_routes_from_api(origin, destination)

    The returned list must follow this schema per route:
        {
            "route_id":           str,    # unique, e.g. "R1"
            "route_name":         str,
            "distance_km":        float,  # must be > 0
            "estimated_time_min": float,  # must be > 0
            "coordinates": [              # REQUIRED FORMAT — list of dicts
                {"lat": 26.1445, "lon": 91.7362},
                {"lat": 25.5788, "lon": 91.8933},
                ...
            ]
        }

    COORDINATE FORMAT CONTRACT (for Person 1 and Person 5):
        Each coordinate MUST be a dict with "lat" and "lon" keys.
        Do NOT use [[lat, lon], ...] arrays — that format is not accepted.

    origin and destination do NOT need to be included in each route object
    (the backend adds them at merge time), but may be included for clarity.
"""

import json
import math
from pathlib import Path
from fastapi import HTTPException

DEMO_DATA_FILE = Path(__file__).parent.parent / "data" / "demo_routes.json"


# ============================================================
# CENTRAL ROUTE VALIDATION (ISSUE 1 + ISSUE 4)
# Runs on EVERY route list regardless of source.
# Called after get_routes() and get_all_demo_routes().
# ============================================================

def validate_routes(routes: list[dict], source: str = "route provider") -> None:
    """
    Validate every route in a list before it enters the risk/scoring pipeline.

    This runs on ALL route data regardless of whether it comes from:
    - demo_routes.json (demo mode)
    - Person 1's live map API (production)
    - any future route provider

    Validates per route:
    - route_id: present, non-empty string, unique within the list
    - route_name: present and non-empty
    - distance_km: numeric and > 0
    - estimated_time_min: numeric and > 0
    - coordinates: a list of {"lat": ..., "lon": ...} dicts

    Raises HTTPException(500) on any violation.
    """
    seen_ids: set[str] = set()

    for i, route in enumerate(routes):
        rid   = route.get("route_id", "")
        label = f"Route at index {i} (route_id='{rid}')"

        # ── route_id ──────────────────────────────────────────────────────
        if not isinstance(rid, str) or not rid.strip():
            raise HTTPException(
                status_code=500,
                detail=f"Route at index {i} from {source}: "
                       f"'route_id' is missing or empty.",
            )
        if rid in seen_ids:
            raise HTTPException(
                status_code=500,
                detail=f"Duplicate route_id '{rid}' from {source}. "
                       f"Every route_id must be unique.",
            )
        seen_ids.add(rid)

        # ── route_name ────────────────────────────────────────────────────
        name = route.get("route_name", "")
        if not isinstance(name, str) or not name.strip():
            raise HTTPException(
                status_code=500,
                detail=f"{label}: 'route_name' is missing or empty.",
            )

        # ── distance_km ───────────────────────────────────────────────────
        dist = route.get("distance_km")
        if (
            dist is None
            or isinstance(dist, bool)
            or not isinstance(dist, (int, float))
            or math.isnan(dist) or math.isinf(dist)
            or dist <= 0
        ):
            raise HTTPException(
                status_code=500,
                detail=f"{label}: 'distance_km' must be a positive number. Got: {dist!r}",
            )

        # ── estimated_time_min ────────────────────────────────────────────
        t = route.get("estimated_time_min")
        if (
            t is None
            or isinstance(t, bool)
            or not isinstance(t, (int, float))
            or math.isnan(t) or math.isinf(t)
            or t <= 0
        ):
            raise HTTPException(
                status_code=500,
                detail=f"{label}: 'estimated_time_min' must be a positive number. Got: {t!r}",
            )

        # ── coordinates — REQUIRED FORMAT: [{"lat": ..., "lon": ...}, ...] ─
        coords = route.get("coordinates")
        if not isinstance(coords, list):
            raise HTTPException(
                status_code=500,
                detail=f"{label}: 'coordinates' must be a list of "
                       f"{{\"lat\": ..., \"lon\": ...}} objects. "
                       f"Got type: {type(coords).__name__}",
            )
        for j, c in enumerate(coords):
            if not isinstance(c, dict) or "lat" not in c or "lon" not in c:
                raise HTTPException(
                    status_code=500,
                    detail=f"{label}: coordinate at index {j} must be "
                           f"{{\"lat\": <number>, \"lon\": <number>}}. Got: {c!r}",
                )
            for field, lo, hi in (("lat", -90.0, 90.0), ("lon", -180.0, 180.0)):
                val = c[field]
                if isinstance(val, bool):
                    raise HTTPException(
                        status_code=500,
                        detail=f"{label}: coordinate[{j}].{field} must be a number, "
                               f"not a boolean. Got: {val!r}",
                    )
                if not isinstance(val, (int, float)):
                    raise HTTPException(
                        status_code=500,
                        detail=f"{label}: coordinate[{j}].{field} must be numeric. "
                               f"Got type: {type(val).__name__!r}, value: {val!r}",
                    )
                if math.isnan(val):
                    raise HTTPException(
                        status_code=500,
                        detail=f"{label}: coordinate[{j}].{field} is NaN.",
                    )
                if math.isinf(val):
                    raise HTTPException(
                        status_code=500,
                        detail=f"{label}: coordinate[{j}].{field} is infinite.",
                    )
                if not (lo <= val <= hi):
                    raise HTTPException(
                        status_code=500,
                        detail=f"{label}: coordinate[{j}].{field} out of range "
                               f"[{lo}, {hi}]. Got: {val}",
                    )



def _load_demo_data() -> list[dict]:
    """Load and basic-parse the demo fallback data file."""
    if not DEMO_DATA_FILE.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Demo route data file not found: {DEMO_DATA_FILE}. "
                   f"Check that data/demo_routes.json exists.",
        )
    try:
        with open(DEMO_DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Demo route data file contains invalid JSON: {e}",
        )
    if not isinstance(data, list):
        raise HTTPException(
            status_code=500,
            detail="demo_routes.json must be a JSON array of route objects.",
        )
    return data


# ── PERSON 1 INTEGRATION POINT ────────────────────────────────────────────────

def get_routes(origin: str, destination: str) -> list[dict]:
    """
    Return a list of possible routes from origin to destination.

    This is the PRIMARY integration point for Person 1.

    CURRENT STATE: PERSON 1 LIVE (Nominatim geocoding + OSRM routing)
        Uses Person 1's route_service module from integrations/person1_routes/.
        Falls back to MOCK_MODE (env ROUTE_MOCK=1) for offline development.

    Args:
        origin:      Source location (any city name)
        destination: Target location (any city name)

    Returns:
        Validated list of route dicts containing:
            route_id, route_name, origin, destination,
            distance_km, estimated_time_min, coordinates

    Raises:
        HTTPException(404) if no routes found.
        HTTPException(503) if the routing API is unreachable.
        HTTPException(500) on malformed route data.
    """
    # ── PERSON 1: REPLACE BELOW THIS LINE ─────────────────────────────────
    import sys
    from pathlib import Path as _Path
    _P1_DIR = str(_Path(__file__).parent.parent / "integrations" / "person1_routes")
    if _P1_DIR not in sys.path:
        sys.path.insert(0, _P1_DIR)

    try:
        import route_service as _p1
        routes = _p1.get_routes(origin, destination)
    except _p1.GeocodingError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Geocoding failed: {exc}",
        )
    except _p1.RoutingError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"No routes found for '{origin}' → '{destination}': {exc}",
        )
    except _p1.RouteServiceError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Route service error: {exc}",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Route data contract violation: {exc}",
        )
    # ── PERSON 1: REPLACE ABOVE THIS LINE ─────────────────────────────────

    # Central validation runs on every route list regardless of source
    validate_routes(routes, source=f"Person 1 / route provider for '{origin}' → '{destination}'")
    return routes


def get_all_demo_routes() -> list[dict]:
    """
    Return every route in the demo data store regardless of corridor.

    Used by:
    - GET /routes  (no filter)
    - GET /routes/{route_id}

    This is a read-only helper. It is NOT the Person 1 integration point
    (that is get_routes() above). In production, Person 1's live API will
    always be called with a specific origin + destination.
    """
    all_routes = _load_demo_data()
    # Validate the entire demo catalogue on load
    validate_routes(all_routes, source="demo_routes.json")
    return all_routes
