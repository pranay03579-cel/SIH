"""
test_scoring.py
---------------
Comprehensive test suite for the MARG Route Accessibility Scoring Engine.

Tests cover all 25 required scenarios:
  1.  Multiple routes with different values
  2.  LOW urgency
  3.  MEDIUM urgency
  4.  HIGH urgency
  5.  CRITICAL urgency
  6.  One route
  7.  Same distance for all routes
  8.  Same travel time for all routes
  9.  Invalid landslide_risk
  10. Negative distance
  11. Negative travel time
  12. Invalid urgency
  13. Empty route list
  14. Missing route_id
  15. Duplicate route_id
  16. Missing distance
  17. Missing travel time
  18. Missing landslide_risk
  19. NaN values
  20. Infinity values
  21. Verify every final score is between 0 and 100
  22. Verify higher landslide_risk reduces risk_score
  23. Verify lower distance receives better distance_score
  24. Verify lower travel_time receives better time_score
  25. Verify CRITICAL urgency gives time greater weight than LOW urgency

Run with:
    python -m pytest test_scoring.py -v
  or:
    python test_scoring.py
"""

import io
import math
import sys
import unittest

# Force UTF-8 on Windows to prevent cp1252 UnicodeEncodeError
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Import everything we need to test
from models import (
    URGENCY_WEIGHTS,
    ValidationError,
    validate_urgency,
    validate_routes,
)
from scoring_engine import (
    calculate_distance_score,
    calculate_risk_score,
    calculate_time_score,
    calculate_accessibility_score,
    get_urgency_weights,
    score_routes,
    score_routes_detailed,
    get_detailed_route_score,
)

# ---------------------------------------------------------------------------
# Shared Fixtures
# ---------------------------------------------------------------------------

DEMO_ROUTES = [
    {
        "route_id": "R1",
        "route_name": "Route via Haflong",
        "distance_km": 180,
        "estimated_time_min": 240,
        "landslide_risk": 82,
        "risk_level": "HIGH",
    },
    {
        "route_id": "R2",
        "route_name": "Route via Shillong",
        "distance_km": 205,
        "estimated_time_min": 285,
        "landslide_risk": 25,
        "risk_level": "LOW",
    },
    {
        "route_id": "R3",
        "route_name": "Alternative Route",
        "distance_km": 195,
        "estimated_time_min": 260,
        "landslide_risk": 45,
        "risk_level": "MEDIUM",
    },
]


# ===========================================================================
# Test: Weight Constants
# ===========================================================================

class TestUrgencyWeights(unittest.TestCase):
    """Verify that urgency weights are correctly configured."""

    def test_weights_sum_to_one_low(self):
        w = URGENCY_WEIGHTS["LOW"]
        total = w["distance"] + w["time"] + w["risk"]
        self.assertAlmostEqual(total, 1.0, places=10,
                               msg="LOW weights do not sum to 1.0")

    def test_weights_sum_to_one_medium(self):
        w = URGENCY_WEIGHTS["MEDIUM"]
        total = w["distance"] + w["time"] + w["risk"]
        self.assertAlmostEqual(total, 1.0, places=10,
                               msg="MEDIUM weights do not sum to 1.0")

    def test_weights_sum_to_one_high(self):
        w = URGENCY_WEIGHTS["HIGH"]
        total = w["distance"] + w["time"] + w["risk"]
        self.assertAlmostEqual(total, 1.0, places=10,
                               msg="HIGH weights do not sum to 1.0")

    def test_weights_sum_to_one_critical(self):
        w = URGENCY_WEIGHTS["CRITICAL"]
        total = w["distance"] + w["time"] + w["risk"]
        self.assertAlmostEqual(total, 1.0, places=10,
                               msg="CRITICAL weights do not sum to 1.0")

    def test_critical_time_weight_greater_than_low(self):
        """Test 25 — CRITICAL urgency gives time a greater weight than LOW."""
        low_time_w      = URGENCY_WEIGHTS["LOW"]["time"]
        critical_time_w = URGENCY_WEIGHTS["CRITICAL"]["time"]
        self.assertGreater(critical_time_w, low_time_w,
                           "CRITICAL time weight must be > LOW time weight")

    def test_get_urgency_weights_returns_correct_dict(self):
        w = get_urgency_weights("HIGH")
        self.assertAlmostEqual(w["distance"], 0.20)
        self.assertAlmostEqual(w["time"],     0.40)
        self.assertAlmostEqual(w["risk"],     0.40)


# ===========================================================================
# Test: Pure Math Functions
# ===========================================================================

class TestCalculateDistanceScore(unittest.TestCase):

    def test_shorter_distance_gets_higher_score(self):
        """Test 23 — lower distance receives a better distance score."""
        score_short = calculate_distance_score(100, 100, 200)
        score_long  = calculate_distance_score(200, 100, 200)
        self.assertGreater(score_short, score_long)

    def test_minimum_distance_scores_100(self):
        score = calculate_distance_score(100, 100, 200)
        self.assertAlmostEqual(score, 100.0)

    def test_maximum_distance_scores_0(self):
        score = calculate_distance_score(200, 100, 200)
        self.assertAlmostEqual(score, 0.0)

    def test_midpoint_scores_50(self):
        score = calculate_distance_score(150, 100, 200)
        self.assertAlmostEqual(score, 50.0)

    def test_all_same_distance_returns_100(self):
        """Test 7 (edge case) — same distance for all routes gives score 100."""
        score = calculate_distance_score(200, 200, 200)
        self.assertAlmostEqual(score, 100.0)


class TestCalculateTimeScore(unittest.TestCase):

    def test_shorter_time_gets_higher_score(self):
        """Test 24 — lower travel time receives a better time score."""
        score_fast = calculate_time_score(120, 120, 300)
        score_slow = calculate_time_score(300, 120, 300)
        self.assertGreater(score_fast, score_slow)

    def test_minimum_time_scores_100(self):
        score = calculate_time_score(120, 120, 300)
        self.assertAlmostEqual(score, 100.0)

    def test_maximum_time_scores_0(self):
        score = calculate_time_score(300, 120, 300)
        self.assertAlmostEqual(score, 0.0)

    def test_midpoint_scores_50(self):
        score = calculate_time_score(210, 120, 300)
        self.assertAlmostEqual(score, 50.0)

    def test_all_same_time_returns_100(self):
        """Test 8 (edge case) — same time for all routes gives score 100."""
        score = calculate_time_score(240, 240, 240)
        self.assertAlmostEqual(score, 100.0)


class TestCalculateRiskScore(unittest.TestCase):

    def test_zero_risk_gives_100(self):
        self.assertAlmostEqual(calculate_risk_score(0), 100.0)

    def test_full_risk_gives_0(self):
        self.assertAlmostEqual(calculate_risk_score(100), 0.0)

    def test_high_risk_reduces_score(self):
        """Test 22 — higher landslide risk reduces risk_score."""
        high_risk_score = calculate_risk_score(80)
        low_risk_score  = calculate_risk_score(20)
        self.assertGreater(low_risk_score, high_risk_score)

    def test_midpoint_risk_gives_50(self):
        self.assertAlmostEqual(calculate_risk_score(50), 50.0)


class TestCalculateAccessibilityScore(unittest.TestCase):

    def test_basic_weighted_sum(self):
        weights = {"distance": 0.20, "time": 0.40, "risk": 0.40}
        score = calculate_accessibility_score(50.0, 60.0, 70.0, weights)
        expected = round(50.0*0.20 + 60.0*0.40 + 70.0*0.40, 2)
        self.assertAlmostEqual(score, expected)

    def test_score_clamped_at_100(self):
        weights = {"distance": 0.20, "time": 0.40, "risk": 0.40}
        score = calculate_accessibility_score(100.0, 100.0, 100.0, weights)
        self.assertLessEqual(score, 100.0)

    def test_score_clamped_at_0(self):
        weights = {"distance": 0.20, "time": 0.40, "risk": 0.40}
        score = calculate_accessibility_score(0.0, 0.0, 0.0, weights)
        self.assertGreaterEqual(score, 0.0)

    def test_result_rounded_to_2dp(self):
        weights = {"distance": 1/3, "time": 1/3, "risk": 1/3}
        score = calculate_accessibility_score(100.0, 100.0, 100.0, weights)
        # Result should have at most 2 decimal places
        self.assertEqual(score, round(score, 2))


# ===========================================================================
# Test: Validation
# ===========================================================================

class TestValidateUrgency(unittest.TestCase):

    def test_valid_uppercase(self):
        self.assertEqual(validate_urgency("HIGH"), "HIGH")

    def test_valid_lowercase(self):
        """Case-insensitive input is normalised to uppercase."""
        self.assertEqual(validate_urgency("critical"), "CRITICAL")

    def test_valid_mixed_case(self):
        self.assertEqual(validate_urgency("Medium"), "MEDIUM")

    def test_invalid_urgency_raises(self):
        """Test 12 — invalid urgency raises ValidationError."""
        with self.assertRaises(ValidationError):
            validate_urgency("EXTREME")

    def test_empty_urgency_raises(self):
        with self.assertRaises(ValidationError):
            validate_urgency("")

    def test_non_string_urgency_raises(self):
        with self.assertRaises(ValidationError):
            validate_urgency(3)


class TestValidateRoutes(unittest.TestCase):

    def test_empty_list_raises(self):
        """Test 13 — empty route list raises ValidationError."""
        with self.assertRaises(ValidationError):
            validate_routes([])

    def test_missing_route_id_raises(self):
        """Test 14 — missing route_id raises ValidationError."""
        bad = [{"distance_km": 100, "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_duplicate_route_id_raises(self):
        """Test 15 — duplicate route_id raises ValidationError."""
        dup = [
            {"route_id": "R1", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 30},
            {"route_id": "R1", "distance_km": 200, "estimated_time_min": 180, "landslide_risk": 60},
        ]
        with self.assertRaises(ValidationError):
            validate_routes(dup)

    def test_missing_distance_raises(self):
        """Test 16 — missing distance_km raises ValidationError."""
        bad = [{"route_id": "R1", "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_missing_travel_time_raises(self):
        """Test 17 — missing estimated_time_min raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_missing_landslide_risk_raises(self):
        """Test 18 — missing landslide_risk raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": 120}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_negative_distance_raises(self):
        """Test 10 — negative distance raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": -10, "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_negative_time_raises(self):
        """Test 11 — negative travel time raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": -5, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_invalid_landslide_risk_above_100_raises(self):
        """Test 9 — landslide_risk above 100 raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 101}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_invalid_landslide_risk_negative_raises(self):
        """Test 9 (continued) — negative landslide_risk raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": -1}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_nan_distance_raises(self):
        """Test 19 — NaN distance raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": float("nan"), "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_nan_time_raises(self):
        """Test 19 — NaN time raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": float("nan"), "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_nan_risk_raises(self):
        """Test 19 — NaN risk raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": float("nan")}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_infinity_distance_raises(self):
        """Test 20 — Infinity distance raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": float("inf"), "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_negative_infinity_time_raises(self):
        """Test 20 — Negative infinity time raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": float("-inf"), "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_infinity_risk_raises(self):
        """Test 20 — Infinity risk raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": float("inf")}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_null_distance_raises(self):
        """None distance should raise ValidationError, not silently become 0."""
        bad = [{"route_id": "R1", "distance_km": None, "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)

    def test_empty_route_id_raises(self):
        bad = [{"route_id": "   ", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            validate_routes(bad)


# ===========================================================================
# Test: score_routes() Integration Tests
# ===========================================================================

class TestScoreRoutes(unittest.TestCase):

    # -------------------------------------------------------------------------
    # Test 1 — Multiple routes with different values
    # -------------------------------------------------------------------------
    def test_multiple_routes_different_values(self):
        results = score_routes(DEMO_ROUTES, "HIGH")
        self.assertEqual(len(results), 3)
        # All route IDs preserved
        ids = {r.route_id for r in results}
        self.assertEqual(ids, {"R1", "R2", "R3"})

    # -------------------------------------------------------------------------
    # Tests 2–5 — All urgency levels produce valid results
    # -------------------------------------------------------------------------
    def test_low_urgency(self):
        """Test 2 — LOW urgency runs without error and returns valid scores."""
        results = score_routes(DEMO_ROUTES, "LOW")
        self._assert_all_scores_valid(results)

    def test_medium_urgency(self):
        """Test 3 — MEDIUM urgency."""
        results = score_routes(DEMO_ROUTES, "MEDIUM")
        self._assert_all_scores_valid(results)

    def test_high_urgency(self):
        """Test 4 — HIGH urgency."""
        results = score_routes(DEMO_ROUTES, "HIGH")
        self._assert_all_scores_valid(results)

    def test_critical_urgency(self):
        """Test 5 — CRITICAL urgency."""
        results = score_routes(DEMO_ROUTES, "CRITICAL")
        self._assert_all_scores_valid(results)

    # -------------------------------------------------------------------------
    # Test 6 — One route
    # -------------------------------------------------------------------------
    def test_single_route(self):
        """Test 6 — single route: distance_score and time_score both become 100."""
        single = [
            {
                "route_id": "SOLO",
                "distance_km": 150,
                "estimated_time_min": 200,
                "landslide_risk": 40,
            }
        ]
        results = score_routes(single, "HIGH")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].route_id, "SOLO")

        # When only one route, d_score=100, t_score=100, r_score=60
        # weights HIGH: d=0.20, t=0.40, r=0.40
        expected = round(100*0.20 + 100*0.40 + 60*0.40, 2)
        self.assertAlmostEqual(results[0].accessibility_score, expected, places=2)

    # -------------------------------------------------------------------------
    # Test 7 — Same distance for all routes
    # -------------------------------------------------------------------------
    def test_same_distance_for_all_routes(self):
        """Test 7 — same distance gives every route distance_score = 100."""
        routes = [
            {"route_id": "A", "distance_km": 200, "estimated_time_min": 100, "landslide_risk": 20},
            {"route_id": "B", "distance_km": 200, "estimated_time_min": 200, "landslide_risk": 50},
            {"route_id": "C", "distance_km": 200, "estimated_time_min": 150, "landslide_risk": 70},
        ]
        detailed = score_routes_detailed(routes, "HIGH")
        for d in detailed:
            self.assertAlmostEqual(d.distance_score, 100.0,
                                   msg=f"Route {d.route_id} should have distance_score=100")

    # -------------------------------------------------------------------------
    # Test 8 — Same travel time for all routes
    # -------------------------------------------------------------------------
    def test_same_travel_time_for_all_routes(self):
        """Test 8 — same travel time gives every route time_score = 100."""
        routes = [
            {"route_id": "A", "distance_km": 100, "estimated_time_min": 240, "landslide_risk": 20},
            {"route_id": "B", "distance_km": 200, "estimated_time_min": 240, "landslide_risk": 50},
            {"route_id": "C", "distance_km": 150, "estimated_time_min": 240, "landslide_risk": 70},
        ]
        detailed = score_routes_detailed(routes, "HIGH")
        for d in detailed:
            self.assertAlmostEqual(d.time_score, 100.0,
                                   msg=f"Route {d.route_id} should have time_score=100")

    # -------------------------------------------------------------------------
    # Tests 9–20 already covered in TestValidateRoutes (validation layer)
    # These integration tests confirm score_routes() also raises ValidationError
    # -------------------------------------------------------------------------
    def test_invalid_urgency_raises(self):
        """Test 12 (integration) — score_routes raises on bad urgency."""
        with self.assertRaises(ValidationError):
            score_routes(DEMO_ROUTES, "TURBO")

    def test_empty_route_list_raises(self):
        """Test 13 (integration) — score_routes raises on empty list."""
        with self.assertRaises(ValidationError):
            score_routes([], "HIGH")

    def test_invalid_landslide_risk_raises(self):
        """Test 9 (integration) — score_routes raises on risk=150."""
        bad_routes = [
            {"route_id": "X1", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 150}
        ]
        with self.assertRaises(ValidationError):
            score_routes(bad_routes, "HIGH")

    def test_negative_distance_raises(self):
        """Test 10 (integration)."""
        bad_routes = [
            {"route_id": "X1", "distance_km": -10, "estimated_time_min": 120, "landslide_risk": 50}
        ]
        with self.assertRaises(ValidationError):
            score_routes(bad_routes, "HIGH")

    def test_negative_time_raises(self):
        """Test 11 (integration)."""
        bad_routes = [
            {"route_id": "X1", "distance_km": 100, "estimated_time_min": -30, "landslide_risk": 50}
        ]
        with self.assertRaises(ValidationError):
            score_routes(bad_routes, "HIGH")

    def test_missing_route_id_raises(self):
        """Test 14 (integration)."""
        bad_routes = [{"distance_km": 100, "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            score_routes(bad_routes, "HIGH")

    def test_duplicate_route_id_raises(self):
        """Test 15 (integration)."""
        dup = [
            {"route_id": "DUP", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 30},
            {"route_id": "DUP", "distance_km": 200, "estimated_time_min": 180, "landslide_risk": 60},
        ]
        with self.assertRaises(ValidationError):
            score_routes(dup, "HIGH")

    def test_missing_distance_raises(self):
        """Test 16 (integration)."""
        bad = [{"route_id": "R1", "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            score_routes(bad, "HIGH")

    def test_missing_time_raises(self):
        """Test 17 (integration)."""
        bad = [{"route_id": "R1", "distance_km": 100, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            score_routes(bad, "HIGH")

    def test_missing_risk_raises(self):
        """Test 18 (integration)."""
        bad = [{"route_id": "R1", "distance_km": 100, "estimated_time_min": 120}]
        with self.assertRaises(ValidationError):
            score_routes(bad, "HIGH")

    def test_nan_raises(self):
        """Test 19 (integration) — NaN in any field raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": float("nan"), "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            score_routes(bad, "HIGH")

    def test_infinity_raises(self):
        """Test 20 (integration) — Infinity raises ValidationError."""
        bad = [{"route_id": "R1", "distance_km": float("inf"), "estimated_time_min": 120, "landslide_risk": 50}]
        with self.assertRaises(ValidationError):
            score_routes(bad, "HIGH")

    # -------------------------------------------------------------------------
    # Test 21 — All scores between 0 and 100
    # -------------------------------------------------------------------------
    def test_all_scores_between_0_and_100(self):
        """Test 21 — every final accessibility_score is in [0, 100]."""
        results = score_routes(DEMO_ROUTES, "HIGH")
        for r in results:
            self.assertGreaterEqual(r.accessibility_score, 0.0,
                                    f"{r.route_id} score below 0")
            self.assertLessEqual(r.accessibility_score, 100.0,
                                 f"{r.route_id} score above 100")

    # -------------------------------------------------------------------------
    # Test 22 — Higher landslide risk reduces risk_score
    # -------------------------------------------------------------------------
    def test_higher_risk_reduces_risk_score(self):
        """Test 22 — route with higher landslide_risk gets lower risk_score."""
        routes = [
            {"route_id": "LOW_RISK",  "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 10},
            {"route_id": "HIGH_RISK", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 90},
        ]
        detailed = score_routes_detailed(routes, "HIGH")
        low_risk_score  = next(d.risk_score for d in detailed if d.route_id == "LOW_RISK")
        high_risk_score = next(d.risk_score for d in detailed if d.route_id == "HIGH_RISK")
        self.assertGreater(low_risk_score, high_risk_score)

    # -------------------------------------------------------------------------
    # Test 23 — Lower distance receives better distance_score
    # -------------------------------------------------------------------------
    def test_lower_distance_gets_better_score(self):
        """Test 23 — route with shorter distance gets higher distance_score."""
        routes = [
            {"route_id": "SHORT", "distance_km": 100, "estimated_time_min": 200, "landslide_risk": 50},
            {"route_id": "LONG",  "distance_km": 300, "estimated_time_min": 200, "landslide_risk": 50},
        ]
        detailed = score_routes_detailed(routes, "HIGH")
        short_d = next(d.distance_score for d in detailed if d.route_id == "SHORT")
        long_d  = next(d.distance_score for d in detailed if d.route_id == "LONG")
        self.assertGreater(short_d, long_d)

    # -------------------------------------------------------------------------
    # Test 24 — Lower travel time receives better time_score
    # -------------------------------------------------------------------------
    def test_lower_travel_time_gets_better_score(self):
        """Test 24 — route with shorter travel time gets higher time_score."""
        routes = [
            {"route_id": "FAST", "distance_km": 200, "estimated_time_min": 100, "landslide_risk": 50},
            {"route_id": "SLOW", "distance_km": 200, "estimated_time_min": 400, "landslide_risk": 50},
        ]
        detailed = score_routes_detailed(routes, "HIGH")
        fast_t = next(d.time_score for d in detailed if d.route_id == "FAST")
        slow_t = next(d.time_score for d in detailed if d.route_id == "SLOW")
        self.assertGreater(fast_t, slow_t)

    # -------------------------------------------------------------------------
    # Test 25 — CRITICAL urgency gives time greater weight than LOW
    # -------------------------------------------------------------------------
    def test_critical_gives_time_more_weight_than_low(self):
        """Test 25 — CRITICAL time weight > LOW time weight (via detailed scores)."""
        # Use a route where time score is distinctly different from risk/distance
        routes = [
            {"route_id": "FAST", "distance_km": 100, "estimated_time_min": 60, "landslide_risk": 50},
            {"route_id": "SLOW", "distance_km": 200, "estimated_time_min": 360, "landslide_risk": 50},
        ]
        critical_details = score_routes_detailed(routes, "CRITICAL")
        low_details      = score_routes_detailed(routes, "LOW")

        # Extract time_weight from the first route's detail
        critical_time_w = critical_details[0].time_weight
        low_time_w      = low_details[0].time_weight

        self.assertGreater(critical_time_w, low_time_w)

    # -------------------------------------------------------------------------
    # route_id Preservation
    # -------------------------------------------------------------------------
    def test_route_id_is_preserved_unchanged(self):
        """route_id must be passed through unchanged."""
        routes = [
            {"route_id": "MY-UNIQUE-ID-999", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 30}
        ]
        results = score_routes(routes, "HIGH")
        self.assertEqual(results[0].route_id, "MY-UNIQUE-ID-999")

    def test_no_recommended_flag_in_output(self):
        """score_routes must NOT add a 'recommended' field."""
        results = score_routes(DEMO_ROUTES, "HIGH")
        for r in results:
            self.assertFalse(hasattr(r, "recommended"),
                             "score_routes must not add a 'recommended' flag")

    # -------------------------------------------------------------------------
    # Large batch
    # -------------------------------------------------------------------------
    def test_large_batch_100_routes(self):
        """Engine must handle 100 routes without error."""
        large_batch = [
            {
                "route_id": f"ROUTE_{i}",
                "distance_km": 100 + i * 2,
                "estimated_time_min": 120 + i * 3,
                "landslide_risk": (i * 7) % 101,   # cycles through 0-100
            }
            for i in range(100)
        ]
        results = score_routes(large_batch, "MEDIUM")
        self.assertEqual(len(results), 100)
        for r in results:
            self.assertGreaterEqual(r.accessibility_score, 0.0)
            self.assertLessEqual(r.accessibility_score, 100.0)

    # ---------------------------------------------------------------------------
    # Helper
    # ---------------------------------------------------------------------------
    def _assert_all_scores_valid(self, results):
        self.assertGreater(len(results), 0)
        for r in results:
            self.assertGreaterEqual(r.accessibility_score, 0.0)
            self.assertLessEqual(r.accessibility_score, 100.0)


# ===========================================================================
# Test: score_routes_detailed()
# ===========================================================================

class TestScoreRoutesDetailed(unittest.TestCase):

    def test_returns_all_fields(self):
        results = score_routes_detailed(DEMO_ROUTES, "HIGH")
        self.assertEqual(len(results), 3)
        for d in results:
            self.assertIsNotNone(d.route_id)
            self.assertIsNotNone(d.distance_score)
            self.assertIsNotNone(d.time_score)
            self.assertIsNotNone(d.risk_score)
            self.assertIsNotNone(d.distance_weight)
            self.assertIsNotNone(d.time_weight)
            self.assertIsNotNone(d.risk_weight)
            self.assertIsNotNone(d.accessibility_score)

    def test_weights_match_urgency(self):
        results = score_routes_detailed(DEMO_ROUTES, "CRITICAL")
        for d in results:
            self.assertAlmostEqual(d.distance_weight, 0.15)
            self.assertAlmostEqual(d.time_weight,     0.50)
            self.assertAlmostEqual(d.risk_weight,     0.35)

    def test_detailed_score_matches_simple_score(self):
        """Detailed and simple scoring must produce identical final scores."""
        simple   = score_routes(DEMO_ROUTES, "MEDIUM")
        detailed = score_routes_detailed(DEMO_ROUTES, "MEDIUM")

        simple_map   = {r.route_id: r.accessibility_score for r in simple}
        detailed_map = {d.route_id: d.accessibility_score for d in detailed}

        for rid in simple_map:
            self.assertAlmostEqual(simple_map[rid], detailed_map[rid], places=2,
                                   msg=f"Mismatch for route {rid}")


# ===========================================================================
# Test: get_detailed_route_score()
# ===========================================================================

class TestGetDetailedRouteScore(unittest.TestCase):

    def test_returns_correct_route(self):
        target = DEMO_ROUTES[1]  # R2
        result = get_detailed_route_score(target, DEMO_ROUTES, "HIGH")
        self.assertEqual(result.route_id, "R2")

    def test_route_not_in_all_routes_raises(self):
        target = {"route_id": "GHOST", "distance_km": 100, "estimated_time_min": 120, "landslide_risk": 30}
        with self.assertRaises(ValidationError):
            get_detailed_route_score(target, DEMO_ROUTES, "HIGH")


# ===========================================================================
# Test: Mathematical Correctness (Manual Verification)
# ===========================================================================

class TestMathematicalCorrectness(unittest.TestCase):
    """
    Manually verify the formula for a known scenario.

    Routes:
      R1: distance=180, time=240, risk=82
      R2: distance=205, time=285, risk=25

    Batch bounds:
      min_distance=180, max_distance=205
      min_time=240,     max_time=285

    HIGH urgency weights: d=0.20, t=0.40, r=0.40
    """

    def setUp(self):
        self.routes = [
            {"route_id": "R1", "distance_km": 180, "estimated_time_min": 240, "landslide_risk": 82},
            {"route_id": "R2", "distance_km": 205, "estimated_time_min": 285, "landslide_risk": 25},
        ]
        self.urgency = "HIGH"

    def test_r1_distance_score(self):
        # R1 is the minimum => should score 100
        score = calculate_distance_score(180, 180, 205)
        self.assertAlmostEqual(score, 100.0, places=5)

    def test_r2_distance_score(self):
        # R2 is the maximum => should score 0
        score = calculate_distance_score(205, 180, 205)
        self.assertAlmostEqual(score, 0.0, places=5)

    def test_r1_time_score(self):
        # R1 is the minimum => should score 100
        score = calculate_time_score(240, 240, 285)
        self.assertAlmostEqual(score, 100.0, places=5)

    def test_r2_time_score(self):
        # R2 is the maximum => should score 0
        score = calculate_time_score(285, 240, 285)
        self.assertAlmostEqual(score, 0.0, places=5)

    def test_r1_risk_score(self):
        score = calculate_risk_score(82)
        self.assertAlmostEqual(score, 18.0, places=5)

    def test_r2_risk_score(self):
        score = calculate_risk_score(25)
        self.assertAlmostEqual(score, 75.0, places=5)

    def test_r1_accessibility_score_high(self):
        # d=100, t=100, r=18, w=(0.20, 0.40, 0.40)
        expected = round(100*0.20 + 100*0.40 + 18*0.40, 2)
        results  = score_routes(self.routes, self.urgency)
        r1       = next(r for r in results if r.route_id == "R1")
        self.assertAlmostEqual(r1.accessibility_score, expected, places=2)

    def test_r2_accessibility_score_high(self):
        # d=0, t=0, r=75, w=(0.20, 0.40, 0.40)
        expected = round(0*0.20 + 0*0.40 + 75*0.40, 2)
        results  = score_routes(self.routes, self.urgency)
        r2       = next(r for r in results if r.route_id == "R2")
        self.assertAlmostEqual(r2.accessibility_score, expected, places=2)


# ===========================================================================
# Entry point
# ===========================================================================

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite  = loader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
