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
from services.scoring_service        import score_routes
from services.recommendation_service import merge_pipeline_data, rank_and_recommend

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

# CORS — allow React frontend (Vite or CRA)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # Create React App
        "http://localhost:5173",    # Vite
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
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
    origin:      str
    destination: str
    urgency:     str = "MEDIUM"

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

    @model_validator(mode="after")
    def origin_and_destination_must_differ(self) -> "RecommendRequest":
        """Reject requests where origin equals destination after normalisation."""
        if self.origin.strip().lower() == self.destination.strip().lower():
            raise ValueError(
                f"Origin and destination must be different. "
                f"Both are '{self.origin}'."
            )
        return self


# ============================================================
# HELPERS
# ============================================================

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
def health_check():
    """Check if the MARG backend is running."""
    return {"status": "MARG Backend Running"}


@app.get("/routes", tags=["Routes"])
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

        enriched["landslide_risk"] = landslide_risk
        enriched["risk_level"]     = risk.get("risk_level")
        routes_with_risk.append(enriched)

    score_map = score_routes(routes_with_risk, urgency=request.urgency)

    # ── Step 4: Merge all data by route_id (Person 4) ──────────────────────
    unified = merge_pipeline_data(
        routes    = routes_with_risk,
        risk_map  = risk_map,
        score_map = score_map,
    )

    # ── Step 5: Rank and select recommendation (Person 4) ──────────────────
    ranked = rank_and_recommend(unified)
    recommended_route = ranked[0]

    return {
        "origin":               request.origin,
        "destination":          request.destination,
        "urgency":              request.urgency,
        "recommended_route_id": recommended_route["route_id"],
        "recommended_route":    recommended_route,
        "routes":               ranked,
    }
