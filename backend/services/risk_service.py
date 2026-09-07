"""
risk_service.py — Person 2 Integration Point
─────────────────────────────────────────────
Responsibility: Predict landslide risk for each route using an ML model.

CURRENT STATE: DEMO FALLBACK
    In demo mode, risk data is pre-embedded in demo_routes.json alongside
    route data. The service reads it directly from the route object.

    This means in demo mode:
      - If a route in the JSON has landslide_risk + risk_level → used as-is.
      - If a route is missing these fields → route is EXCLUDED from
        recommendation (not silently treated as safe).

HOW PERSON 2 INTEGRATES:
    Replace the body of `predict_route_risk()` with a call to Person 2's
    ML model.

    Example:

        from person2_module import ml_predict_risk

        def predict_route_risk(route: dict) -> dict:
            return ml_predict_risk(route)

    The returned dict must follow this schema:
        {
            "route_id":       str,   # MUST match the input route's route_id
            "landslide_risk": float, # 0–100, higher = more dangerous; not bool
            "risk_level":     str    # "LOW" | "MEDIUM" | "HIGH" (any case → normalised)
        }

CRITICAL DESIGN RULES:
    1. Missing risk data does NOT mean a route is safe.
       A route without confirmed risk prediction must raise an error.
    2. landslide_risk must be numeric (int or float), NOT bool.
    3. risk_level is normalised to uppercase before validation.
    4. The returned route_id must match the input route's route_id.
"""

import math
from fastapi import HTTPException

VALID_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH"}


def _validate_risk(risk_data: dict, expected_route_id: str) -> None:
    """
    Validate risk data returned by Person 2's model.

    Checks:
    - route_id must be present and must match the input route's route_id (ISSUE 6)
    - landslide_risk must be present, numeric (not bool), finite, and in [0, 100] (ISSUE 4)
    - risk_level must be present and normalised to LOW/MEDIUM/HIGH (ISSUE 5)
    """
    # ── route_id match (ISSUE 6) ──────────────────────────────────────────
    if "route_id" not in risk_data:
        raise HTTPException(
            status_code=500,
            detail=f"Person 2 integration error: risk output is missing 'route_id'. "
                   f"Expected route_id='{expected_route_id}'.",
        )
    if risk_data["route_id"] != expected_route_id:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Person 2 integration error: route_id mismatch. "
                f"Input route was '{expected_route_id}' but Person 2 returned "
                f"route_id='{risk_data['route_id']}'. "
                f"route_id is the primary integration key — output must match input."
            ),
        )

    # ── landslide_risk (ISSUE 4) ──────────────────────────────────────────
    if "landslide_risk" not in risk_data:
        raise HTTPException(
            status_code=500,
            detail=f"Risk data for route '{expected_route_id}' is missing 'landslide_risk'.",
        )
    lr = risk_data["landslide_risk"]
    if isinstance(lr, bool):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': landslide_risk must be a number, "
                   f"not a boolean. Got: {lr!r}",
        )
    if not isinstance(lr, (int, float)):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': landslide_risk must be numeric. "
                   f"Got type: {type(lr).__name__!r}",
        )
    if math.isnan(lr) or math.isinf(lr):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': landslide_risk must be a finite number. "
                   f"Got: {lr}",
        )
    if not (0 <= lr <= 100):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': landslide_risk must be between 0 and 100. "
                   f"Got: {lr}",
        )

    # ── risk_level — normalise then validate (ISSUE 5) ────────────────────
    if "risk_level" not in risk_data:
        raise HTTPException(
            status_code=500,
            detail=f"Risk data for route '{expected_route_id}' is missing 'risk_level'.",
        )
    rl_raw = risk_data["risk_level"]
    if not isinstance(rl_raw, str):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': risk_level must be a string. "
                   f"Got type: {type(rl_raw).__name__!r}",
        )
    rl_normalised = rl_raw.strip().upper()
    if rl_normalised not in VALID_RISK_LEVELS:
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': risk_level must be LOW, MEDIUM, or HIGH. "
                   f"Got: '{rl_raw}'",
        )
    # Write the normalised value back so callers always receive uppercase
    risk_data["risk_level"] = rl_normalised


# ── PERSON 2 INTEGRATION POINT ────────────────────────────────────────────────

def predict_route_risk(route: dict) -> dict:
    """
    Predict landslide risk for a single route.

    This is the PRIMARY integration point for Person 2.

    CURRENT STATE: PERSON 2 LIVE (RandomForest ML model)
        1. Computes average slope from the NE India elevation dataset.
        2. Fetches rainfall_24h_mm + rainfall_7d_mm from Open-Meteo.
        3. Calls Person 2's trained RandomForest model (landslide_model.pkl).

    The ML model requires exactly:
        ["rainfall_24h_mm", "rainfall_7d_mm", "slope_deg"]
    in that feature order. This matches Person 2's train_model.py exactly.

    PRODUCTION (when Person 2 replaces with a different model):
        Replace the block between REPLACE markers below.

    Args:
        route: A route dict from get_routes(), must contain 'coordinates'.

    Returns:
        Dict with: route_id (matches input), landslide_risk (0-100),
                   risk_level (LOW/MEDIUM/HIGH)

    Raises:
        HTTPException if environmental data or ML prediction fails.
    """
    route_id    = route.get("route_id", "UNKNOWN")
    coordinates = route.get("coordinates", [])

    # ── PERSON 2: REPLACE BELOW THIS LINE ─────────────────────────────────
    import sys
    from pathlib import Path as _Path

    # ── Step 1: Compute average slope from elevation dataset ────────────────
    from services.environmental_service import compute_average_slope_deg
    slope_deg = compute_average_slope_deg(coordinates)

    # ── Step 2: Fetch rainfall from Open-Meteo ──────────────────────────────
    from services.weather_service import get_route_rainfall
    rainfall = get_route_rainfall(coordinates)
    rainfall_24h_mm = rainfall["rainfall_24h_mm"]
    rainfall_7d_mm  = rainfall["rainfall_7d_mm"]

    # ── Step 3: Load Person 2's trained model and run inference ─────────────
    import importlib.util as _ilu
    _P2_PREDICT = _Path(__file__).parent.parent / "integrations" / "person2_landslide_model" / "predict.py"
    _spec = _ilu.spec_from_file_location("p2_predict", str(_P2_PREDICT))
    predict_mod = _ilu.module_from_spec(_spec)
    _spec.loader.exec_module(predict_mod)

    # Call Person 2's predict_landslide_risk() with exact feature names
    result = predict_mod.predict_landslide_risk(
        rainfall_24h_mm = rainfall_24h_mm,
        rainfall_7d_mm  = rainfall_7d_mm,
        slope_deg       = slope_deg,
    )

    risk_data = {
        "route_id":       route_id,
        "landslide_risk": result["landslide_risk"],
        "risk_level":     result["risk_level"],
    }
    # ── PERSON 2: REPLACE ABOVE THIS LINE ─────────────────────────────────

    # Validate and normalise output (runs regardless of demo or production mode)
    _validate_risk(risk_data, expected_route_id=route_id)
    return risk_data


def predict_risks_for_routes(routes: list[dict]) -> dict[str, dict]:
    """
    Run predict_route_risk() for every route in the list.

    Returns a dict keyed by route_id for easy lookup:
        { "R1": { "route_id": "R1", "landslide_risk": 82, "risk_level": "HIGH" }, ... }

    Routes for which risk cannot be determined raise an error immediately.
    """
    return {r["route_id"]: predict_route_risk(r) for r in routes}
