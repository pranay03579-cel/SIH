"""
scoring_engine.py
-----------------
MARG Route Accessibility Scoring Engine  (Person 3 - Standalone Component)

Public API
----------
    score_routes(routes, urgency)          -> List[RouteScore]
    score_routes_detailed(routes, urgency) -> List[DetailedRouteScore]

Usage
-----
    from scoring_engine import score_routes

    results = score_routes(routes, "HIGH")
    for r in results:
        print(r.route_id, r.accessibility_score)

This module is completely self-contained.
It does NOT call any external API, database, or other team member's code.
"""

from typing import List

from models import (
    URGENCY_WEIGHTS,
    DetailedRouteScore,
    RouteInput,
    RouteScore,
    ValidationError,
    validate_routes,
    validate_urgency,
)


# ===========================================================================
# Pure Mathematical Helper Functions
# ===========================================================================

def get_urgency_weights(urgency: str) -> dict:
    """
    Return the weight dictionary for a given (already-validated) urgency level.

    Parameters
    ----------
    urgency : str
        Normalised urgency string: "LOW", "MEDIUM", "HIGH", or "CRITICAL".

    Returns
    -------
    dict
        {"distance": float, "time": float, "risk": float}
        The three values always sum to 1.0.
    """
    return URGENCY_WEIGHTS[urgency]


def calculate_distance_score(distance: float, min_distance: float, max_distance: float) -> float:
    """
    Calculate the normalised distance score for a single route.

    A shorter distance receives a higher score.

    Formula
    -------
        score = 100 * (max_distance - distance) / (max_distance - min_distance)

    Edge case: if all distances are equal (max == min), every route scores 100.

    Parameters
    ----------
    distance     : Distance of the route being scored.
    min_distance : Minimum distance across all routes in the batch.
    max_distance : Maximum distance across all routes in the batch.

    Returns
    -------
    float
        Score in [0.0, 100.0].
    """
    if max_distance == min_distance:
        return 100.0
    return 100.0 * (max_distance - distance) / (max_distance - min_distance)


def calculate_time_score(time: float, min_time: float, max_time: float) -> float:
    """
    Calculate the normalised travel-time score for a single route.

    A shorter travel time receives a higher score.

    Formula
    -------
        score = 100 * (max_time - time) / (max_time - min_time)

    Edge case: if all times are equal (max == min), every route scores 100.

    Parameters
    ----------
    time     : Travel time of the route being scored.
    min_time : Minimum travel time across all routes in the batch.
    max_time : Maximum travel time across all routes in the batch.

    Returns
    -------
    float
        Score in [0.0, 100.0].
    """
    if max_time == min_time:
        return 100.0
    return 100.0 * (max_time - time) / (max_time - min_time)


def calculate_risk_score(landslide_risk: float) -> float:
    """
    Calculate the landslide risk score.

    A lower landslide risk receives a higher score.

    Formula
    -------
        risk_score = 100 - landslide_risk

    This is an absolute formula; it does NOT depend on other routes.

    Parameters
    ----------
    landslide_risk : Value in [0, 100] representing landslide risk.

    Returns
    -------
    float
        Score in [0.0, 100.0].
    """
    return 100.0 - landslide_risk


def calculate_accessibility_score(
    distance_score: float,
    time_score: float,
    risk_score: float,
    weights: dict,
) -> float:
    """
    Compute the weighted accessibility score from the three component scores.

    Formula
    -------
        score = (distance_score * distance_weight)
              + (time_score     * time_weight)
              + (risk_score     * risk_weight)

    The result is rounded to 2 decimal places and clamped to [0.0, 100.0].

    Parameters
    ----------
    distance_score : Normalised distance score (0-100).
    time_score     : Normalised time score (0-100).
    risk_score     : Risk score (0-100).
    weights        : Dict with keys "distance", "time", "risk".

    Returns
    -------
    float
        Final accessibility score in [0.0, 100.0].
    """
    raw_score = (
        distance_score * weights["distance"]
        + time_score   * weights["time"]
        + risk_score   * weights["risk"]
    )

    # Clamp to [0, 100] to handle any floating-point edge cases.
    clamped = max(0.0, min(100.0, raw_score))
    return round(clamped, 2)


# ===========================================================================
# Batch Normalization Helper
# ===========================================================================

def _compute_normalization_bounds(routes: List[RouteInput]) -> dict:
    """
    Compute min/max bounds needed for batch normalisation.

    Parameters
    ----------
    routes : List[RouteInput]
        Validated list of route inputs (at least one element).

    Returns
    -------
    dict
        {
            "min_distance": float,
            "max_distance": float,
            "min_time"    : float,
            "max_time"    : float,
        }
    """
    distances = [r.distance_km for r in routes]
    times     = [r.estimated_time_min for r in routes]

    return {
        "min_distance": min(distances),
        "max_distance": max(distances),
        "min_time":     min(times),
        "max_time":     max(times),
    }


# ===========================================================================
# Public API
# ===========================================================================

def score_routes(routes: list, urgency: str) -> List[RouteScore]:
    """
    Calculate the accessibility score for every route in the batch.

    This is the **primary public function** of the scoring engine.
    Another developer can import and call this function directly.

    Parameters
    ----------
    routes  : list
        List of route dictionaries.  Each dictionary must contain:
            - "route_id"           (str,   non-empty, unique)
            - "distance_km"        (float, >= 0)
            - "estimated_time_min" (float, >= 0)
            - "landslide_risk"     (float, 0-100)

        Optional fields (not used in scoring):
            - "route_name"  (str)
            - "risk_level"  (str)

    urgency : str
        Urgency level (case-insensitive): "LOW", "MEDIUM", "HIGH", "CRITICAL".
        Controls the relative weight of distance, time, and landslide risk.

    Returns
    -------
    List[RouteScore]
        One RouteScore per input route, in the same order as the input.
        Each RouteScore contains:
            - route_id           : str   (unchanged from input)
            - accessibility_score: float (0.0 - 100.0, rounded to 2 dp)

    Raises
    ------
    ValidationError
        If urgency is invalid, the route list is empty, or any route fails
        field-level validation.

    Example
    -------
    >>> from scoring_engine import score_routes
    >>> results = score_routes(routes, "HIGH")
    >>> for r in results:
    ...     print(r.route_id, r.accessibility_score)
    """
    # 1. Validate inputs
    urgency_norm    = validate_urgency(urgency)
    validated_routes = validate_routes(routes)

    # 2. Compute normalization bounds from the full batch
    bounds = _compute_normalization_bounds(validated_routes)

    # 3. Get urgency weights
    weights = get_urgency_weights(urgency_norm)

    # 4. Score every route
    results: List[RouteScore] = []

    for route in validated_routes:
        d_score = calculate_distance_score(
            route.distance_km,
            bounds["min_distance"],
            bounds["max_distance"],
        )
        t_score = calculate_time_score(
            route.estimated_time_min,
            bounds["min_time"],
            bounds["max_time"],
        )
        r_score = calculate_risk_score(route.landslide_risk)

        final_score = calculate_accessibility_score(d_score, t_score, r_score, weights)

        results.append(RouteScore(
            route_id=route.route_id,
            accessibility_score=final_score,
        ))

    return results


def score_routes_detailed(routes: list, urgency: str) -> List[DetailedRouteScore]:
    """
    Calculate the accessibility score for every route and return a full breakdown.

    Use this function when you need to explain the scoring to SIH judges or
    when debugging the scores.

    Parameters
    ----------
    routes  : list
        Same format as score_routes().
    urgency : str
        Same format as score_routes().

    Returns
    -------
    List[DetailedRouteScore]
        One DetailedRouteScore per input route, in input order.
        Each object contains:
            - route_id
            - distance_score
            - time_score
            - risk_score
            - distance_weight
            - time_weight
            - risk_weight
            - accessibility_score

    Raises
    ------
    ValidationError
        Same conditions as score_routes().

    Example
    -------
    >>> from scoring_engine import score_routes_detailed
    >>> details = score_routes_detailed(routes, "HIGH")
    >>> for d in details:
    ...     print(d)
    """
    # 1. Validate inputs
    urgency_norm     = validate_urgency(urgency)
    validated_routes  = validate_routes(routes)

    # 2. Compute normalization bounds
    bounds = _compute_normalization_bounds(validated_routes)

    # 3. Get urgency weights
    weights = get_urgency_weights(urgency_norm)

    # 4. Score every route with full breakdown
    results: List[DetailedRouteScore] = []

    for route in validated_routes:
        d_score = calculate_distance_score(
            route.distance_km,
            bounds["min_distance"],
            bounds["max_distance"],
        )
        t_score = calculate_time_score(
            route.estimated_time_min,
            bounds["min_time"],
            bounds["max_time"],
        )
        r_score = calculate_risk_score(route.landslide_risk)

        final_score = calculate_accessibility_score(d_score, t_score, r_score, weights)

        results.append(DetailedRouteScore(
            route_id=route.route_id,
            distance_score=round(d_score, 2),
            time_score=round(t_score, 2),
            risk_score=round(r_score, 2),
            distance_weight=weights["distance"],
            time_weight=weights["time"],
            risk_weight=weights["risk"],
            accessibility_score=final_score,
        ))

    return results


def get_detailed_route_score(
    route: dict,
    all_routes: list,
    urgency: str,
) -> DetailedRouteScore:
    """
    Return the detailed score for a single specific route, scored in the
    context of the full batch (normalization uses the entire batch).

    Parameters
    ----------
    route      : dict  - The specific route you want details for.
    all_routes : list  - All routes including the one above (for normalization).
    urgency    : str   - Urgency level.

    Returns
    -------
    DetailedRouteScore for the requested route.

    Raises
    ------
    ValidationError
        If the route is not found in all_routes or inputs are invalid.
    KeyError
        If route_id is missing from the target route dict.
    """
    target_id = route.get("route_id")
    if target_id is None:
        raise ValidationError("The target route is missing 'route_id'.")

    detailed_scores = score_routes_detailed(all_routes, urgency)

    for d in detailed_scores:
        if d.route_id == str(target_id).strip():
            return d

    raise ValidationError(
        f"Route '{target_id}' was not found in the provided all_routes list."
    )
