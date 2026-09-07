"""
scoring_service.py — Person 3 Integration (ACTIVE)
────────────────────────────────────────────────────
Responsibility: Calculate an accessibility score for each candidate route
using Person 3's Route Scoring Engine.

CURRENT STATE: PERSON 3 LIVE
    Calls Person 3's score_routes() from:
        integrations/person3_scoring_engine/scoring_engine.py

    ALL candidate routes are passed together in a single batch call so that
    Person 3's relative (batch) normalisation is applied correctly across
    the full set of routes.

    Scores are then merged back into the route set using route_id as the
    integration key — never by list position.

PERSON 3 INTEGRATION POINT:
    Person 3's mathematical algorithm lives exclusively in:
        integrations/person3_scoring_engine/scoring_engine.py
        integrations/person3_scoring_engine/models.py

    Do NOT modify the algorithm here.
    Do NOT add a second scoring formula here.

HOW THE BACKEND CALLS THIS SERVICE:
    From main.py:
        score_map = score_routes(routes_with_risk, urgency=request.urgency)
        # Returns: {"R1": 72.5, "R2": 45.0, ...}

    The dict is keyed by route_id and consumed by recommendation_service.py.

ROUTE_ID CONTRACT:
    route_id is the integration key connecting Person 1, Person 2, and Person 3.
    It MUST NEVER be changed, regenerated, or mapped by list position.
"""

import math
import importlib.util
import logging
from pathlib import Path
from fastapi import HTTPException

log = logging.getLogger(__name__)

# ── Path to Person 3's engine ─────────────────────────────────────────────────
_P3_DIR     = Path(__file__).parent.parent / "integrations" / "person3_scoring_engine"
_P3_ENGINE  = _P3_DIR / "scoring_engine.py"
_P3_MODELS  = _P3_DIR / "models.py"


# ── Load Person 3's modules once at import time ───────────────────────────────
# We use spec_from_file_location so that scoring_engine.py's own
# "from models import ..." resolves correctly relative to its own directory,
# regardless of the backend's working directory.

def _load_p3_modules():
    """Load person3 models.py then scoring_engine.py. Returns scoring_engine module."""
    if not _P3_ENGINE.exists():
        raise RuntimeError(
            f"Person 3 scoring engine not found at {_P3_ENGINE}. "
            "Ensure integrations/person3_scoring_engine/ is present."
        )
    if not _P3_MODELS.exists():
        raise RuntimeError(
            f"Person 3 models.py not found at {_P3_MODELS}. "
            "Ensure integrations/person3_scoring_engine/models.py is present."
        )

    # 1. Load models.py first (scoring_engine.py depends on it)
    models_spec   = importlib.util.spec_from_file_location("p3_models", str(_P3_MODELS))
    models_mod    = importlib.util.module_from_spec(models_spec)
    models_spec.loader.exec_module(models_mod)

    # 2. Load scoring_engine.py — inject the already-loaded models module into
    #    its namespace so "from models import ..." resolves to our loaded copy.
    import sys as _sys
    _sys.modules["models"] = models_mod   # satisfy "from models import ..." inside scoring_engine.py

    engine_spec   = importlib.util.spec_from_file_location("p3_scoring_engine", str(_P3_ENGINE))
    engine_mod    = importlib.util.module_from_spec(engine_spec)
    engine_spec.loader.exec_module(engine_mod)

    return engine_mod, models_mod


try:
    _P3_ENGINE_MOD, _P3_MODELS_MOD = _load_p3_modules()
    _P3_AVAILABLE = True
    log.info("Person 3 scoring engine loaded from %s", _P3_ENGINE)
except Exception as _p3_err:
    log.error("Person 3 scoring engine failed to load: %s", _p3_err)
    _P3_ENGINE_MOD = None
    _P3_MODELS_MOD = None
    _P3_AVAILABLE  = False


# ── Score validation (kept for safety — runs on every score returned) ─────────

def _validate_score(score, route_id: str) -> float:
    """
    Validate a single accessibility score.

    Rejects: None, booleans, non-numeric types, NaN, infinity, out-of-range.
    Accepts: any finite float or int in [0.0, 100.0].

    Raises HTTPException(500) on any violation.
    Returns the score as a float on success.
    """
    if score is None:
        raise HTTPException(
            status_code=500,
            detail=f"Route '{route_id}': accessibility_score is None. "
                   f"Person 3's scoring model must return a number in [0, 100]. "
                   f"A missing score is NOT treated as 0.",
        )
    if isinstance(score, bool):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{route_id}': accessibility_score must be a number, "
                   f"not a boolean. Got: {score!r}",
        )
    if not isinstance(score, (int, float)):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{route_id}': accessibility_score must be numeric. "
                   f"Got type: {type(score).__name__!r}, value: {score!r}",
        )
    if math.isnan(score):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{route_id}': accessibility_score is NaN. "
                   f"Person 3's model returned an invalid value.",
        )
    if math.isinf(score):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{route_id}': accessibility_score is infinite. "
                   f"Person 3's model returned an invalid value.",
        )
    if not (0.0 <= score <= 100.0):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{route_id}': accessibility_score must be between "
                   f"0 and 100. Got: {score}",
        )
    return float(score)


# ══════════════════════════════════════════════════════════════════════════════
# PRIMARY PUBLIC FUNCTION — called by main.py
# ══════════════════════════════════════════════════════════════════════════════

def score_routes(routes: list[dict], urgency: str) -> dict[str, float]:
    """
    Calculate accessibility scores for ALL candidate routes using Person 3's engine.

    Returns a dict keyed by route_id:
        { "R1": 72.5, "R2": 45.0, ... }

    CONTRACT:
      - ALL routes are passed together in a single batch call so Person 3's
        relative normalisation (min/max across routes) is applied correctly.
      - Scores are merged back using route_id — NEVER by list position.
      - route_id is NEVER modified.
      - Every score is validated before being returned.

    Args:
        routes:  List of route dicts. Each must contain:
                     route_id           (str)
                     distance_km        (float >= 0)
                     estimated_time_min (float >= 0)
                     landslide_risk     (float 0-100, from Person 2)
                 Additional fields (coordinates, risk_level, etc.) are passed
                 through transparently and ignored by Person 3's engine.
        urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

    Returns:
        Dict[route_id -> accessibility_score (float 0.0-100.0)]

    Raises:
        HTTPException(503) if Person 3's engine is unavailable.
        HTTPException(400/422) if urgency or route fields are invalid.
        HTTPException(500) if a returned score fails validation.
    """
    if not _P3_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Person 3's scoring engine is not available. "
                f"Ensure {_P3_ENGINE} and {_P3_MODELS} exist and import correctly."
            ),
        )

    if not routes:
        raise HTTPException(
            status_code=500,
            detail="score_routes() received an empty route list. "
                   "At least one route must be present before scoring.",
        )

    # ── Step 1: Call Person 3's engine with ALL routes as a single batch ──────
    # score_routes(routes, urgency) → List[RouteScore]
    # Each RouteScore has: .route_id, .accessibility_score
    try:
        p3_results = _P3_ENGINE_MOD.score_routes(routes, urgency)
    except _P3_MODELS_MOD.ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Person 3 scoring engine validation error: {exc}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Person 3 scoring engine raised an unexpected error: {exc}",
        )

    # ── Step 2: Build score_map keyed by route_id ─────────────────────────────
    # Merge by route_id — NEVER by list position or zip().
    scores: dict[str, float] = {}
    for result in p3_results:
        rid   = result.route_id
        score = result.accessibility_score
        scores[rid] = _validate_score(score, rid)

    log.info(
        "Person 3 scored %d route(s) [urgency=%s]: %s",
        len(scores),
        urgency,
        {rid: s for rid, s in scores.items()},
    )
    return scores


def score_routes_detailed(routes: list[dict], urgency: str) -> dict[str, dict]:
    """
    Calculate accessibility scores with full component breakdown using Person 3's engine.

    This calls Person 3's score_routes_detailed() — NOT a second scoring formula.
    Person 3's scoring_engine.py remains the single and only source of truth.

    Returns a dict keyed by route_id:
        {
            "R1": {
                "distance_score":   72.5,
                "time_score":       65.0,
                "risk_score":       75.0,
                "distance_weight":  0.3,
                "time_weight":      0.3,
                "risk_weight":      0.4,
                "accessibility_score": 71.0
            },
            ...
        }

    Raises:
        HTTPException(503) if Person 3's engine is unavailable.
        HTTPException(422) if inputs fail Person 3's validation.
        HTTPException(500) if a returned score fails post-validation.
    """
    if not _P3_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Person 3's scoring engine is not available. "
                f"Ensure {_P3_ENGINE} and {_P3_MODELS} exist and import correctly."
            ),
        )

    if not routes:
        raise HTTPException(
            status_code=500,
            detail="score_routes_detailed() received an empty route list.",
        )

    try:
        p3_results = _P3_ENGINE_MOD.score_routes_detailed(routes, urgency)
    except _P3_MODELS_MOD.ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Person 3 scoring engine validation error: {exc}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Person 3 scoring engine raised an unexpected error: {exc}",
        )

    detailed: dict[str, dict] = {}
    for result in p3_results:
        rid   = result.route_id
        score = _validate_score(result.accessibility_score, rid)
        detailed[rid] = {
            "distance_score":    round(result.distance_score, 2),
            "time_score":        round(result.time_score, 2),
            "risk_score":        round(result.risk_score, 2),
            "distance_weight":   result.distance_weight,
            "time_weight":       result.time_weight,
            "risk_weight":       result.risk_weight,
            "accessibility_score": score,
        }

    log.info(
        "Person 3 detailed scoring: %d route(s) [urgency=%s]",
        len(detailed), urgency,
    )
    return detailed

