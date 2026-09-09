"""
MARG - AI-Based Smart Logistics and Accessibility Intelligence Platform
Backend API — Person 4 (Orchestration Layer)

Author: Person 4
Role:   FastAPI orchestration — validation, pipeline coordination, API endpoints

Pipeline
────────
User Request (origin + destination + urgency)
    ↓
services/route_service.py       ← Person 1: route generation
    ↓
services/risk_service.py        ← Person 2: ML landslide risk prediction
    ↓
services/scoring_service.py     ← Person 3: mathematical accessibility scoring
    ↓
services/recommendation_service.py  ← Person 4: merge + rank + recommend
    ↓
JSON response to Person 5 (React frontend)

Integration contract: route_id is the common key across all services.
"""

from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator, model_validator

from services.route_service          import get_routes, get_all_demo_routes
from services.risk_service           import predict_risks_for_routes
from services.scoring_service        import score_routes, score_routes_detailed
from services.recommendation_service import merge_pipeline_data, rank_and_recommend
from services.vehicle_service       import VALID_VEHICLE_TYPES, calculate_vehicle_suitability

# Emergency rerouting uses coordinate-based routing from Person 1's module
import sys as _sys
from pathlib import Path as _Path
_P1_DIR = str(_Path(__file__).parent / "integrations" / "person1_routes")
if _P1_DIR not in _sys.path:
    _sys.path.insert(0, _P1_DIR)
import route_service as _p1_module

# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(
    title="MARG - Smart Logistics & Accessibility Platform",
    description=(
        "AI-Based Smart Logistics and Accessibility Intelligence Platform "
        "for the North Eastern Region of India.\n\n"
        "**Core principle:** Shortest Route ≠ Most Accessible Route\n\n"
        "The system analyses multiple routes between any origin and destination "
        "and recommends the most suitable one based on distance, travel time, "
        "landslide risk, and delivery urgency."
    ),
    version="1.0.0",
)

# CORS — allow React frontend (Vite, Vercel deployments, localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://([a-zA-Z0-9_-]+\.)*vercel\.app$|^https?://localhost(:\d+)?$|^https?://127\.0\.0\.1(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CONSTANTS
# ============================================================

VALID_URGENCY_VALUES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

# ============================================================
# REQUEST MODEL
# All validation lives here — keeps endpoint code clean.
# ============================================================

class RecommendRequest(BaseModel):
    origin:       str
    destination:  str
    urgency:      str = "MEDIUM"
    vehicle_type: str = "CAR"

    @field_validator("origin", "destination", mode="before")
    @classmethod
    def strip_and_require(cls, v: str, info) -> str:
        """Reject empty or whitespace-only origin/destination."""
        stripped = v.strip() if isinstance(v, str) else ""
        if not stripped:
            raise ValueError(
                f"'{info.field_name}' must not be empty or whitespace-only."
            )
        return stripped

    @field_validator("urgency", mode="before")
    @classmethod
    def validate_urgency(cls, v: str) -> str:
        """Normalise and validate urgency. Accepts any case."""
        normalized = v.upper().strip() if isinstance(v, str) else ""
        if normalized not in VALID_URGENCY_VALUES:
            raise ValueError(
                f"Invalid urgency '{v}'. "
                f"Allowed values: {', '.join(sorted(VALID_URGENCY_VALUES))}"
            )
        return normalized

    @field_validator("vehicle_type", mode="before")
    @classmethod
    def validate_vehicle_type(cls, v: str) -> str:
        """Normalise and validate vehicle_type. Accepts any case."""
        normalized = v.upper().strip() if isinstance(v, str) else ""
        if not normalized:
            return "CAR"
        if normalized not in VALID_VEHICLE_TYPES:
            raise ValueError(
                f"Invalid vehicle_type '{v}'. "
                f"Allowed values: {', '.join(sorted(VALID_VEHICLE_TYPES))}"
            )
        return normalized

    @model_validator(mode="after")
    def origin_and_destination_must_differ(self) -> "RecommendRequest":
        """Reject requests where origin equals destination after normalisation."""
        if self.origin.strip().lower() == self.destination.strip().lower():
            raise ValueError(
                f"Origin and destination must be different. "
                f"Both are '{self.origin}'."
            )
        return self


class CoordinatePoint(BaseModel):
    """A geographic coordinate point (WGS84)."""
    lat: float
    lon: float

    @field_validator("lat", mode="before")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not isinstance(v, (int, float)) or not (-90.0 <= v <= 90.0):
            raise ValueError(f"lat must be a number in [-90, 90]. Got: {v!r}")
        return float(v)

    @field_validator("lon", mode="before")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        if not isinstance(v, (int, float)) or not (-180.0 <= v <= 180.0):
            raise ValueError(f"lon must be a number in [-180, 180]. Got: {v!r}")
        return float(v)


class RerouteRequest(BaseModel):
    """
    Request body for POST /reroute — Emergency Dynamic Rerouting.

    current_location : vehicle's actual GPS position (becomes new origin)
    destination      : original named destination (geocoded normally)
    blocked_location : landslide incident position (used for route filtering)
    urgency          : emergency urgency level (same values as /recommend-route)
    vehicle_type     : vehicle type for suitability scoring (CAR, TRUCK, etc.)
    """
    current_location: CoordinatePoint
    destination:      str
    blocked_location: CoordinatePoint
    urgency:          str = "HIGH"
    vehicle_type:     Optional[str] = "CAR"

    @field_validator("destination", mode="before")
    @classmethod
    def strip_destination(cls, v: str) -> str:
        stripped = v.strip() if isinstance(v, str) else ""
        if not stripped:
            raise ValueError("'destination' must not be empty.")
        return stripped

    @field_validator("urgency", mode="before")
    @classmethod
    def validate_urgency(cls, v: str) -> str:
        normalized = v.upper().strip() if isinstance(v, str) else ""
        if normalized not in VALID_URGENCY_VALUES:
            raise ValueError(
                f"Invalid urgency '{v}'. "
                f"Allowed values: {', '.join(sorted(VALID_URGENCY_VALUES))}"
            )
        return normalized

    @field_validator("vehicle_type", mode="before")
    @classmethod
    def validate_vehicle_type(cls, v: Optional[str]) -> str:
        if v is None:
            return "CAR"
        normalized = v.upper().strip() if isinstance(v, str) else ""
        if not normalized:
            return "CAR"
        if normalized not in VALID_VEHICLE_TYPES:
            raise ValueError(
                f"Invalid vehicle_type '{v}'. "
                f"Allowed values: {', '.join(sorted(VALID_VEHICLE_TYPES))}"
            )
        return normalized


# ============================================================
# HELPERS
# ============================================================

import math

# Minimum safe distance from a blocked incident location (configurable).
# Any route that passes within this radius of the landslide
# is considered blocked and excluded from emergency alternatives.
BLOCK_RADIUS_METERS = 300.0
BLOCKED_RADIUS_METERS = BLOCK_RADIUS_METERS


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two WGS84 points."""
    R = 6_371_000.0  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _route_intersects_blocked_zone(
    route_coordinates: list,
    blocked_lat: float,
    blocked_lon: float,
    radius_m: float = BLOCK_RADIUS_METERS,
) -> bool:
    """
    Return True if ANY coordinate in the route passes within radius_m metres
    of the blocked incident location.
    """
    for coord in route_coordinates:
        lat = coord.get("lat") if isinstance(coord, dict) else (coord[0] if isinstance(coord, (list, tuple)) else None)
        lon = coord.get("lon") if isinstance(coord, dict) else (coord[1] if isinstance(coord, (list, tuple)) else None)
        if lat is None or lon is None:
            continue
        if _haversine_meters(lat, lon, blocked_lat, blocked_lon) <= radius_m:
            return True
    return False


def _route_passes_near_incident(
    route: dict,
    blocked_lat: float,
    blocked_lon: float,
    radius_m: float = BLOCK_RADIUS_METERS,
) -> bool:
    """Convenience wrapper checking a route object against the blocked zone."""
    return _route_intersects_blocked_zone(
        route.get("coordinates", []), blocked_lat, blocked_lon, radius_m=radius_m
    )


def _require_both_or_neither(raw_query_params, origin: Optional[str], destination: Optional[str]) -> None:
    """
    For GET /routes: enforce that origin and destination are either
    both provided (with non-blank values) or both absent.

    Uses raw_query_params (from Request.query_params) to reliably detect
    whether a parameter was explicitly supplied in the URL, even when its
    value is empty. FastAPI converts ?origin= to None for Optional[str]
    parameters, so checking `origin is not None` is NOT sufficient.

    Cases that raise HTTP 400:
    - ?origin=X  only  (destination missing)
    - ?destination=Y only  (origin missing)
    - ?origin=&destination=  (both blank)
    - ?origin=   &destination=Silchar  (one blank)
    - ?origin=Guwahati&destination=  (other blank)

    Only case that returns all routes:
    - No query params at all (neither key present in URL)
    """
    # Use raw query string to detect parameters that were explicitly provided
    # but have empty/whitespace values (FastAPI maps these to None, losing the distinction)
    origin_in_qs      = "origin"      in raw_query_params
    destination_in_qs = "destination" in raw_query_params

    # Value from raw params (may differ from FastAPI-parsed value for empty strings)
    origin_val      = raw_query_params.get("origin",      "").strip()
    destination_val = raw_query_params.get("destination", "").strip()

    # Blank-but-present params are always an error
    if origin_in_qs and not origin_val:
        raise HTTPException(
            status_code=400,
            detail="Query parameter 'origin' was provided but is empty or whitespace-only. "
                   "Either supply a valid city name or omit the parameter entirely.",
        )
    if destination_in_qs and not destination_val:
        raise HTTPException(
            status_code=400,
            detail="Query parameter 'destination' was provided but is empty or whitespace-only. "
                   "Either supply a valid city name or omit the parameter entirely.",
        )

    # One present with a value, the other absent
    if origin_in_qs and origin_val and not destination_in_qs:
        raise HTTPException(
            status_code=400,
            detail="Both 'origin' and 'destination' query parameters are required when filtering. "
                   "'origin' was provided but 'destination' is missing.",
        )
    if destination_in_qs and destination_val and not origin_in_qs:
        raise HTTPException(
            status_code=400,
            detail="Both 'origin' and 'destination' query parameters are required when filtering. "
                   "'destination' was provided but 'origin' is missing.",
        )


# ============================================================
# API ENDPOINTS
# ============================================================

@app.get("/", tags=["Health"])
@app.get("/api", tags=["Health"])
def root_check():
    """Check if the MARG backend is running."""
    return {"status": "MARG Backend Running"}


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint for frontend and monitoring."""
    return {"status": "ok"}


@app.get("/routes", tags=["Routes"])
@app.get("/api/routes", tags=["Routes"])
def get_all_routes(
    request:     Request,
    origin:      Optional[str] = Query(default=None, description="Filter by origin city (case-insensitive)"),
    destination: Optional[str] = Query(default=None, description="Filter by destination city (case-insensitive)"),
):
    """
    Return available demo/fallback routes.

    - No parameters              → all routes across all corridors
    - ?origin=X&destination=Y   → routes for that corridor only
    - ?origin=X only            → 400 error (both or neither required)
    - ?destination=Y only       → 400 error (both or neither required)
    - ?origin=&destination=     → 400 error (blank values detected)

    Example:
        GET /routes
        GET /routes?origin=Guwahati&destination=Silchar
    """
    # Pass raw query params so blank-but-present values are correctly detected
    _require_both_or_neither(request.query_params, origin, destination)

    # Both present and non-blank (validated above)
    if "origin" in request.query_params and "destination" in request.query_params:
        o = request.query_params["origin"].strip()
        d = request.query_params["destination"].strip()
        routes = get_routes(o, d)
        return {
            "origin":      o,
            "destination": d,
            "total":       len(routes),
            "routes":      routes,
        }

    # No filter — return full demo catalogue
    all_routes = get_all_demo_routes()
    return {
        "total":  len(all_routes),
        "routes": all_routes,
    }


@app.get("/routes/{route_id}", tags=["Routes"])
@app.get("/api/routes/{route_id}", tags=["Routes"])
def get_route_by_id(route_id: str):
    """
    Return complete information for a single route.

    - Case-insensitive lookup.
    - Returns HTTP 404 if route_id does not exist.

    Example: GET /routes/R1
    """
    # Load all demo routes and search — avoids duplicating logic in main.py
    all_routes = get_all_demo_routes()
    target = route_id.upper()

    for route in all_routes:
        if route.get("route_id", "").upper() == target:
            return route

    valid_ids = ", ".join(r["route_id"] for r in all_routes)
    raise HTTPException(
        status_code=404,
        detail=f"Route '{route_id}' not found. Valid route IDs: {valid_ids}",
    )


@app.post("/recommend-route", tags=["Recommendation"])
@app.post("/api/recommend-route", tags=["Recommendation"])
def recommend_route(request: RecommendRequest):
    """
    AI Route Recommendation Engine — orchestrates the full pipeline.

    Pipeline executed on every request (never uses cached/stored state):

    1.  Validate request          (Pydantic — runs before this function)
    2.  get_routes()              Person 1 → possible routes for corridor
    3.  predict_risks_for_routes() Person 2 → landslide risk per route
    4.  score_routes()            Person 3 → accessibility score per route
    5.  merge_pipeline_data()     Person 4 → unified route objects
    6.  rank_and_recommend()      Person 4 → sorted + exactly-one recommended

    Request body:
        { "origin": "Guwahati", "destination": "Silchar", "urgency": "HIGH" }

    NOTE: Guwahati → Silchar is DEMO DATA only.
    The backend supports any corridor present in the data store.
    """

    # ── Step 1: Get routes (Person 1) ──────────────────────────────────────
    routes = get_routes(request.origin, request.destination)

    if not routes:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No routes found for the corridor "
                f"'{request.origin}' → '{request.destination}'. "
                f"Ensure routes for this corridor exist in the data store "
                f"or that Person 1's route-generation service covers it."
            ),
        )

    # ── Step 2: Predict risk (Person 2) ────────────────────────────────────
    # predict_risks_for_routes() raises HTTP 503 if any route is missing risk data.
    # Missing risk ≠ safe — routes with unknown risk are not silently included.
    risk_map = predict_risks_for_routes(routes)

    # ── Step 3: Score routes (Person 3) ────────────────────────────────────
    # Needs risk data merged into routes first so scoring can use landslide_risk.
    # We pass the routes enriched with risk for scoring context.
    routes_with_risk = []
    for route in routes:
        rid      = route["route_id"]
        enriched = {**route}

        # Missing route_id from risk_map → Person 2 did not return a prediction.
        # Unknown risk MUST NOT be treated as safe (risk 0.0).
        if rid not in risk_map:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Route '{rid}' has no landslide risk prediction from Person 2. "
                    f"Missing risk data is NOT treated as safe (risk=0). "
                    f"Person 2's model must return a prediction for every route."
                ),
            )

        risk = risk_map[rid]

        # landslide_risk missing or None → explicit error, never default to 0.0.
        # NOTE: numeric 0 is a valid value (perfectly safe route) and is accepted.
        landslide_risk = risk.get("landslide_risk")
        if landslide_risk is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Route '{rid}': Person 2 returned a risk entry but "
                    f"'landslide_risk' is missing or None. "
                    f"A missing landslide_risk is NOT treated as 0."
                ),
            )

        enriched["landslide_risk"]       = landslide_risk
        enriched["risk_level"]           = risk.get("risk_level")
        enriched["landslide_risk_level"] = risk.get("landslide_risk_level", risk.get("risk_level"))
        enriched["waterlogging_risk"]    = risk.get("waterlogging_risk")
        enriched["waterlogging_level"]   = risk.get("waterlogging_level")
        enriched["waterlogging_factors"] = risk.get("waterlogging_factors")
        enriched["combined_hazard_risk"] = risk.get("combined_hazard_risk", landslide_risk)
        routes_with_risk.append(enriched)

    # Call Person 3's detailed scoring (single batch call — same engine, richer output).
    # score_routes_detailed returns component scores for frontend explainability.
    # Person 3's formula is NOT duplicated here.
    detail_map = score_routes_detailed(routes_with_risk, urgency=request.urgency)

    # Derive the simple score_map needed by recommendation_service
    score_map = {rid: d["accessibility_score"] for rid, d in detail_map.items()}

    # Embed component breakdown into routes_with_risk so it flows through to
    # the final API response — merged by route_id, never by list position.
    for route in routes_with_risk:
        rid = route["route_id"]
        if rid in detail_map:
            d = detail_map[rid]
            route["distance_score"]  = d["distance_score"]
            route["time_score"]      = d["time_score"]
            route["risk_score"]      = d["risk_score"]
            route["distance_weight"] = d["distance_weight"]
            route["time_weight"]     = d["time_weight"]
            route["risk_weight"]     = d["risk_weight"]

    # ── Step 4: Merge all data by route_id (Person 4) ──────────────────────
    unified = merge_pipeline_data(
        routes    = routes_with_risk,
        risk_map  = risk_map,
        score_map = score_map,
    )

    # ── Step 5: Rank and select recommendation (Person 4 & Vehicle Layer) ──
    ranked = rank_and_recommend(unified, vehicle_type=request.vehicle_type)
    recommended_route = ranked[0]

    return {
        "origin":               request.origin,
        "destination":          request.destination,
        "urgency":              request.urgency,
        "vehicle_type":         request.vehicle_type,
        "recommended_route_id": recommended_route["route_id"],
        "recommended_route":    recommended_route,
        "routes":               ranked,
    }


# ============================================================
# EMERGENCY REROUTING ENDPOINT
# ============================================================

@app.post("/reroute", tags=["Emergency Rerouting"])
@app.post("/api/reroute", tags=["Emergency Rerouting"])
def emergency_reroute(request: RerouteRequest):
    """
    Emergency Dynamic Rerouting — Phase 5.

    Triggered when a landslide is detected during a vehicle simulation.
    Generates new route alternatives from the vehicle's current position
    to the original destination, filters out routes passing through the
    blocked zone, scores them through the full MARG pipeline, and returns
    the best emergency alternative.

    Pipeline:
    1. get_routes_from_coords()        Person 1 (coord-based, skips geocoding)
    2. _route_passes_near_incident()   Blocked-zone filter (haversine)
    3. predict_risks_for_routes()      Person 2 — ML landslide risk
    4. score_routes_detailed()         Person 3 — accessibility scoring
    5. merge_pipeline_data()           Person 4 — unified route objects
    6. rank_and_recommend()            Person 4 — rank + recommend

    NOTE on OSRM limitation:
        OSRM's public server does not support live road closures. We request
        multiple alternative routes and discard any that pass within
        BLOCKED_RADIUS_METERS of the landslide coordinates. This is a
        transparent MVP-safe approximation — the comment is in the code.

    Request body:
        {
          "current_location": {"lat": 26.123, "lon": 91.456},
          "destination": "Tezpur, Assam",
          "blocked_location": {"lat": 26.200, "lon": 91.600},
          "urgency": "HIGH"
        }
    """
    cur = request.current_location
    blk = request.blocked_location

    # Validate: vehicle and blocked positions must be real coordinates
    if cur.lat == 0.0 and cur.lon == 0.0:
        raise HTTPException(
            status_code=422,
            detail="current_location appears invalid (0.0, 0.0). Vehicle position was not set.",
        )

    import logging as _log
    logger = _log.getLogger("emergency_rerouting")

    logger.info("Emergency rerouting started for destination: '%s'", request.destination)

    fallback_diversion_used = False
    raw_routes: list[dict] = []
    safe_routes: list[dict] = []
    blocked_count = 0

    # ── Strategy 1: Normal OSRM alternatives from vehicle coordinates ────────
    try:
        raw_routes = _p1_module.get_routes_from_coords(
            orig_lat=cur.lat,
            orig_lon=cur.lon,
            destination=request.destination,
            origin_label=f"Emergency Origin ({cur.lat:.4f},{cur.lon:.4f})",
        )
        safe_routes = [
            r for r in raw_routes
            if not _route_passes_near_incident(
                r, blk.lat, blk.lon, radius_m=BLOCK_RADIUS_METERS
            )
        ]
        blocked_count = len(raw_routes) - len(safe_routes)
    except _p1_module.GeocodingRateLimitError:
        raise HTTPException(
            status_code=503,
            detail="Location service temporarily busy. Please try again in a moment.",
        )
    except _p1_module.GeocodingError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Destination could not be geocoded: {exc}",
        )
    except Exception as exc:
        logger.warning("Strategy 1 direct routing failed (%s) — falling back to Strategy 2", exc)

    # ── Strategy 2: Diversion waypoint fallback around landslide zone ────────
    if not safe_routes:
        fallback_diversion_used = True
        logger.info("Strategy 1 returned 0 safe routes — executing Strategy 2 diversion waypoints...")
        try:
            safe_routes = _p1_module.get_diversion_routes(
                orig_lat=cur.lat,
                orig_lon=cur.lon,
                blocked_lat=blk.lat,
                blocked_lon=blk.lon,
                destination=request.destination,
                radius_m=BLOCK_RADIUS_METERS,
                origin_label=f"Emergency Origin ({cur.lat:.4f},{cur.lon:.4f})",
            )
        except _p1_module.GeocodingRateLimitError:
            raise HTTPException(
                status_code=503,
                detail="Location service temporarily busy. Please try again in a moment.",
            )
        except _p1_module.GeocodingError as exc:
            raise HTTPException(
                status_code=404,
                detail=f"Destination could not be geocoded: {exc}",
            )
        except _p1_module.RoutingError as exc:
            raise HTTPException(
                status_code=404,
                detail=f"No safe alternative corridor could be generated around the incident: {exc}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Emergency diversion routing service error: {exc}",
            )

    candidate_total = len(raw_routes) if not fallback_diversion_used else (len(raw_routes) + len(safe_routes))

    # Log required diagnostics
    logger.info("Candidate routes received: %d", candidate_total)
    logger.info("Routes blocked: %d", blocked_count)
    logger.info("Safe routes found: %d", len(safe_routes))
    logger.info("Fallback diversion strategy used: %s", "Yes" if fallback_diversion_used else "No")

    if not safe_routes:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No safe alternative corridor could be generated from the current location. "
                f"All candidate route(s) passed within {BLOCK_RADIUS_METERS:.0f}m "
                f"of the blocked incident zone."
            ),
        )

    # ── Step 3: Person 2 — predict landslide risk for each safe route ────────
    risk_map = predict_risks_for_routes(safe_routes)

    # ── Step 4: Person 3 — accessibility scoring (reuses existing pipeline) ──
    routes_with_risk = []
    for route in safe_routes:
        rid = route["route_id"]
        enriched = {**route}
        if rid not in risk_map:
            raise HTTPException(
                status_code=503,
                detail=f"Route '{rid}' has no risk prediction — Person 2 must score all routes.",
            )
        risk = risk_map[rid]
        landslide_risk = risk.get("landslide_risk")
        if landslide_risk is None:
            raise HTTPException(
                status_code=503,
                detail=f"Route '{rid}': Person 2 returned no 'landslide_risk' value.",
            )
        enriched["landslide_risk"]       = landslide_risk
        enriched["risk_level"]           = risk.get("risk_level")
        enriched["landslide_risk_level"] = risk.get("landslide_risk_level", risk.get("risk_level"))
        enriched["waterlogging_risk"]    = risk.get("waterlogging_risk")
        enriched["waterlogging_level"]   = risk.get("waterlogging_level")
        enriched["waterlogging_factors"] = risk.get("waterlogging_factors")
        enriched["combined_hazard_risk"] = risk.get("combined_hazard_risk", landslide_risk)
        routes_with_risk.append(enriched)

    detail_map = score_routes_detailed(routes_with_risk, urgency=request.urgency)
    score_map  = {rid: d["accessibility_score"] for rid, d in detail_map.items()}

    for route in routes_with_risk:
        rid = route["route_id"]
        if rid in detail_map:
            d = detail_map[rid]
            route["distance_score"]  = d["distance_score"]
            route["time_score"]      = d["time_score"]
            route["risk_score"]      = d["risk_score"]
            route["distance_weight"] = d["distance_weight"]
            route["time_weight"]     = d["time_weight"]
            route["risk_weight"]     = d["risk_weight"]

    # ── Step 5 & 6: Person 4 — merge, rank, recommend ────────────────────────
    unified = merge_pipeline_data(
        routes    = routes_with_risk,
        risk_map  = risk_map,
        score_map = score_map,
    )
    ranked = rank_and_recommend(unified, vehicle_type=request.vehicle_type)
    recommended_route = ranked[0]

    return {
        "current_location":        {"lat": cur.lat, "lon": cur.lon},
        "destination":             request.destination,
        "blocked_location":        {"lat": blk.lat, "lon": blk.lon},
        "urgency":                 request.urgency,
        "vehicle_type":            request.vehicle_type,
        "blocked_routes_count":    blocked_count,
        "candidate_routes_count":  candidate_total,
        "safe_routes_count":       len(safe_routes),
        "fallback_diversion_used": fallback_diversion_used,
        "recommended_route_id":    recommended_route["route_id"],
        "recommended_route":       recommended_route,
        "routes":                  ranked,
    }


# ============================================================
# LOCATION AUTOCOMPLETE & GEOCODING PROXY
# Free, open geocoding with Northeast India proximity bias
# ============================================================

import urllib.request as _urllib_request
import urllib.parse as _urllib_parse
import json as _json

@app.get("/locations/search", tags=["Locations"])
@app.get("/api/locations/search", tags=["Locations"])
@app.get("/location-suggestions", tags=["Locations"])
@app.get("/api/location-suggestions", tags=["Locations"])
def search_locations(q: str = Query(..., min_length=1, description="Location search query")):
    """
    Open geocoding autocomplete proxy.
    Returns normalized place suggestions prioritized for Northeast India.
    No frontend API keys required.
    """
    q_clean = q.strip()
    if not q_clean or len(q_clean) < 2:
        return []

    results = []
    seen = set()

    # 1. Curated NE India fallback dictionary for instantaneous, highly accurate local hits
    try:
        from integrations.person1_routes.route_service import _DEMO_FALLBACK_COORDS
        q_lower = q_clean.lower()
        for name, (lat, lon) in _DEMO_FALLBACK_COORDS.items():
            if name.startswith(q_lower) or q_lower in name:
                title = name.title()
                base_city = title.split(",")[0].strip()
                state = "Assam"
                for st in ["Meghalaya", "Arunachal Pradesh", "Manipur", "Mizoram", "Nagaland", "Tripura", "Sikkim", "Assam"]:
                    if st.lower() in name:
                        state = st
                        break

                clean_display = f"{base_city}, {state}, India"
                key = f"{base_city.lower()}_{state.lower()}"
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "name": base_city,
                        "display_name": clean_display,
                        "lat": lat,
                        "lon": lon,
                        "state": state,
                        "is_northeast": True,
                        "is_india": True
                    })
    except Exception:
        pass

    # 2. Live query to Photon (OpenStreetMap geocoder) with Northeast India proximity bias
    try:
        params = _urllib_parse.urlencode({
            "q": q_clean,
            "limit": 10,
            "lat": 26.2,
            "lon": 92.5,
            "lang": "en"
        })
        url = f"https://photon.komoot.io/api/?{params}"
        req = _urllib_request.Request(url, headers={"User-Agent": "MARG-Logistics-Platform/1.0"})
        with _urllib_request.urlopen(req, timeout=3.5) as resp:
            data = _json.loads(resp.read().decode("utf-8"))
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                coords = feature.get("geometry", {}).get("coordinates", [])
                if len(coords) >= 2:
                    lon, lat = coords[0], coords[1]
                    name = props.get("name") or props.get("city") or q_clean
                    state = props.get("state", "")
                    country = props.get("country", "India")
                    district = props.get("district") or props.get("county") or ""

                    parts = []
                    if district and district != name:
                        parts.append(district)
                    if state and state != name:
                        parts.append(state)
                    if country and country != state:
                        parts.append(country)

                    display_name = f"{name}, {', '.join(parts)}" if parts else name
                    key = f"{name.lower()}_{state.lower()}"

                    if key not in seen:
                        seen.add(key)
                        ne_states = {"assam", "meghalaya", "arunachal pradesh", "manipur", "mizoram", "nagaland", "tripura", "sikkim"}
                        is_ne = any(st in (state.lower() + " " + display_name.lower()) for st in ne_states)
                        is_india = country.lower() == "india" or "india" in display_name.lower()

                        results.append({
                            "name": name,
                            "display_name": display_name,
                            "lat": lat,
                            "lon": lon,
                            "state": state or ("Northeast India" if is_ne else country),
                            "is_northeast": is_ne,
                            "is_india": is_india
                        })
    except Exception:
        pass

    # Sort results: Northeast India first, then all India, then global
    def sort_key(r):
        if r.get("is_northeast"):
            return 0
        if r.get("is_india"):
            return 1
        return 2

    results.sort(key=sort_key)
    return results[:8]


