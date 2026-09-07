"""
recommendation_service.py — Backend Orchestration (Person 4)
─────────────────────────────────────────────────────────────
Responsibility: Merge route data, risk predictions, and accessibility scores
then rank and select the best route.

This is Person 4's core logic — no teammates need to touch this file.
"""

import copy
from fastapi import HTTPException


def merge_pipeline_data(
    routes:       list[dict],
    risk_map:     dict[str, dict],
    score_map:    dict[str, float],
) -> list[dict]:
    """
    Merge output from Person 1 (routes), Person 2 (risk), and Person 3 (scores)
    into unified route objects using route_id as the common key.

    Args:
        routes:    List of route dicts from route_service.get_routes()
        risk_map:  Dict keyed by route_id from risk_service.predict_risks_for_routes()
                   { "R1": {"route_id":"R1","landslide_risk":82,"risk_level":"HIGH"}, ... }
        score_map: Dict keyed by route_id from scoring_service.score_routes()
                   { "R1": 42.0, "R2": 87.0, ... }

    Returns:
        List of unified route dicts, each containing all fields needed by frontend:
            route_id, route_name, distance_km, estimated_time_min, coordinates,
            landslide_risk, risk_level, accessibility_score, recommended (=False)

    Raises:
        HTTPException(500) if a route is missing its score from Person 3.
        Missing score is NOT silently converted to 0.
    """
    merged = []
    for route in routes:
        rid      = route["route_id"]
        combined = copy.copy(route)

        # Attach risk data — missing or None risk is an explicit error.
        # Unknown risk MUST NOT be silently accepted as safe (risk=0).
        # Numeric 0 is a valid observation and is accepted.
        if rid not in risk_map:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Route '{rid}' is missing from risk_map. "
                    f"Person 2 must return a risk prediction for every route. "
                    f"Missing risk is NOT treated as safe (risk=0)."
                ),
            )
        risk           = risk_map[rid]
        landslide_risk = risk.get("landslide_risk")
        if landslide_risk is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Route '{rid}': risk entry exists but 'landslide_risk' is "
                    f"missing or None. Missing risk is NOT treated as 0."
                ),
            )
        combined["landslide_risk"] = landslide_risk
        combined["risk_level"]     = risk.get("risk_level")

        # Attach accessibility score — missing score is an explicit error (ISSUE 2)
        if rid not in score_map:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Route '{rid}' is missing an accessibility score. "
                    f"Person 3's scoring model did not return a score for this route. "
                    f"Missing score is NOT treated as 0 — all routes must be scored "
                    f"before recommendation can proceed."
                ),
            )
        combined["accessibility_score"] = score_map[rid]

        # recommended is always determined fresh — never taken from stored data
        combined["recommended"] = False

        merged.append(combined)

    return merged


def rank_and_recommend(unified_routes: list[dict]) -> list[dict]:
    """
    Sort routes by accessibility_score (descending) and mark exactly ONE
    route as recommended=True.

    The recommended route is always the one with the highest accessibility_score.
    This is recalculated fresh on every request — never read from stored data.

    Args:
        unified_routes: Output of merge_pipeline_data()

    Returns:
        Sorted list of route dicts with recommended field set correctly.
        Exactly one route will have recommended=True.
    """
    ranked = copy.deepcopy(unified_routes)
    ranked.sort(key=lambda r: r.get("accessibility_score", 0.0), reverse=True)

    for i, route in enumerate(ranked):
        route["recommended"] = (i == 0)

    return ranked
