"""
demo.py
-------
Demonstration script for the MARG Route Accessibility Scoring Engine.

Run this file to see the scoring engine in action:
    python demo.py

This script is completely self-contained.
It does NOT require any external API, database, or backend.
"""

import io
import json
import sys
from dataclasses import asdict

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from scoring_engine import score_routes, score_routes_detailed

# ---------------------------------------------------------------------------
# Demo routes: Guwahati -> Silchar (used only as example data)
# ---------------------------------------------------------------------------
"""
demo.py
-------
Demonstration script for the MARG Route Accessibility Scoring Engine.

Run this file to see the scoring engine in action:
    python demo.py

This script is completely self-contained.
It does NOT require any external API, database, or backend.
"""

import io
import json
import sys
from dataclasses import asdict

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from scoring_engine import score_routes, score_routes_detailed

# ---------------------------------------------------------------------------
# Demo routes: Guwahati -> Silchar (used only as example data)
# ---------------------------------------------------------------------------

EXAMPLE_ROUTES = [
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

URGENCY = "HIGH"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SEP = "=" * 62

def section(title: str):
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


def print_json(obj):
    print(json.dumps(obj, indent=4))


# ---------------------------------------------------------------------------
# Main demo
# ---------------------------------------------------------------------------

def run_demo():
    print("\n" + SEP)
    print("  MARG — Route Accessibility Scoring Engine  (Person 3)")
    print(SEP)

    # ------------------------------------------------------------------
    # 1. Show input
    # ------------------------------------------------------------------
    section("INPUT — Example Routes")
    print_json(EXAMPLE_ROUTES)

    section(f"URGENCY: {URGENCY}")
    print("  Weights for HIGH urgency:")
    print("    distance : 0.20")
    print("    time     : 0.40")
    print("    risk     : 0.40")
    print("    --------------")
    print("    total    : 1.00")

    # ------------------------------------------------------------------
    # 2. Run simple scoring
    # ------------------------------------------------------------------
    section("OUTPUT — Accessibility Scores (Simple)")
    results = score_routes(EXAMPLE_ROUTES, URGENCY)
    simple_output = [asdict(r) for r in results]
    print_json(simple_output)

    # ------------------------------------------------------------------
    # 3. Run detailed scoring
    # ------------------------------------------------------------------
    section("OUTPUT — Accessibility Scores (Detailed / Explainable)")
    detailed = score_routes_detailed(EXAMPLE_ROUTES, URGENCY)
    detailed_output = [asdict(d) for d in detailed]
    print_json(detailed_output)

    # ------------------------------------------------------------------
    # 4. Explain the formula
    # ------------------------------------------------------------------
    section("FORMULA EXPLANATION")
    print("""
  Step 1 — Normalise distance:
      distance_score = 100 × (max_dist - dist) / (max_dist - min_dist)
      → Shorter distance = higher score.

  Step 2 — Normalise travel time:
      time_score = 100 × (max_time - time) / (max_time - min_time)
      → Shorter time = higher score.

  Step 3 — Calculate risk score:
      risk_score = 100 - landslide_risk
      → Lower landslide risk = higher score. (No normalisation needed.)

  Step 4 — Weighted sum:
      accessibility_score = (distance_score × distance_weight)
                          + (time_score     × time_weight)
                          + (risk_score     × risk_weight)

  Final score is clamped to [0, 100] and rounded to 2 decimal places.
""")

    # ------------------------------------------------------------------
    # 5. Show how to import
    # ------------------------------------------------------------------
    section("HOW TO IMPORT (for backend integration)")
    print("""
  from scoring_engine import score_routes

  routes  = [...]        # list of route dicts
  urgency = "HIGH"       # LOW | MEDIUM | HIGH | CRITICAL

  results = score_routes(routes, urgency)

  for r in results:
      print(r.route_id, r.accessibility_score)
""")

    # ------------------------------------------------------------------
    # 6. Edge-case demos
    # ------------------------------------------------------------------
    section("EDGE CASE — Single Route")
    single_route = [
        {
            "route_id": "SOLO",
            "route_name": "Only Available Route",
            "distance_km": 150,
            "estimated_time_min": 200,
            "landslide_risk": 40,
        }
    ]
    single_results = score_routes(single_route, "CRITICAL")
    print("  Input  :", json.dumps(single_route[0], indent=4))
    print("  Output :", asdict(single_results[0]))
    print("  (distance_score = 100, time_score = 100 when only one route exists)")

    section("EDGE CASE — Same Distance for All Routes")
    same_dist = [
        {"route_id": "A", "distance_km": 200, "estimated_time_min": 100, "landslide_risk": 10},
        {"route_id": "B", "distance_km": 200, "estimated_time_min": 200, "landslide_risk": 60},
        {"route_id": "C", "distance_km": 200, "estimated_time_min": 300, "landslide_risk": 80},
    ]
    same_dist_detailed = score_routes_detailed(same_dist, "HIGH")
    print("  All routes have distance_km = 200.")
    print("  Expected: distance_score = 100 for every route.")
    for d in same_dist_detailed:
        print(f"    {d.route_id}: distance_score = {d.distance_score}")

    section("EDGE CASE — Same Travel Time for All Routes")
    same_time = [
        {"route_id": "X", "distance_km": 100, "estimated_time_min": 240, "landslide_risk": 20},
        {"route_id": "Y", "distance_km": 200, "estimated_time_min": 240, "landslide_risk": 50},
    ]
    same_time_detailed = score_routes_detailed(same_time, "MEDIUM")
    print("  All routes have estimated_time_min = 240.")
    print("  Expected: time_score = 100 for every route.")
    for d in same_time_detailed:
        print(f"    {d.route_id}: time_score = {d.time_score}")

    # ------------------------------------------------------------------
    # 7. Urgency comparison
    # ------------------------------------------------------------------
    section("URGENCY COMPARISON — How urgency shifts scores")
    for urg in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        res = score_routes(EXAMPLE_ROUTES, urg)
        scores_str = "  |  ".join(
            f"{r.route_id}: {r.accessibility_score:6.2f}" for r in res
        )
        print(f"  [{urg:8s}]  {scores_str}")

    print(f"\n{SEP}")
    print("  Demo complete. Standalone engine verified.")
    print(SEP + "\n")


if __name__ == "__main__":
    run_demo()

EXAMPLE_ROUTES = [
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

URGENCY = "HIGH"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SEP = "=" * 62

def section(title: str):
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


def print_json(obj):
    print(json.dumps(obj, indent=4))


# ---------------------------------------------------------------------------
# Main demo
# ---------------------------------------------------------------------------

def run_demo():
    print("\n" + SEP)
    print("  MARG — Route Accessibility Scoring Engine  (Person 3)")
    print(SEP)

    # ------------------------------------------------------------------
    # 1. Show input
    # ------------------------------------------------------------------
    section("INPUT — Example Routes")
    print_json(EXAMPLE_ROUTES)

    section(f"URGENCY: {URGENCY}")
    print("  Weights for HIGH urgency:")
    print("    distance : 0.20")
    print("    time     : 0.40")
    print("    risk     : 0.40")
    print("    --------------")
    print("    total    : 1.00")

    # ------------------------------------------------------------------
    # 2. Run simple scoring
    # ------------------------------------------------------------------
    section("OUTPUT — Accessibility Scores (Simple)")
    results = score_routes(EXAMPLE_ROUTES, URGENCY)
    simple_output = [asdict(r) for r in results]
    print_json(simple_output)

    # ------------------------------------------------------------------
    # 3. Run detailed scoring
    # ------------------------------------------------------------------
    section("OUTPUT — Accessibility Scores (Detailed / Explainable)")
    detailed = score_routes_detailed(EXAMPLE_ROUTES, URGENCY)
    detailed_output = [asdict(d) for d in detailed]
    print_json(detailed_output)

    # ------------------------------------------------------------------
    # 4. Explain the formula
    # ------------------------------------------------------------------
    section("FORMULA EXPLANATION")
    print("""
  Step 1 — Normalise distance:
      distance_score = 100 × (max_dist - dist) / (max_dist - min_dist)
      → Shorter distance = higher score.

  Step 2 — Normalise travel time:
      time_score = 100 × (max_time - time) / (max_time - min_time)
      → Shorter time = higher score.

  Step 3 — Calculate risk score:
      risk_score = 100 - landslide_risk
      → Lower landslide risk = higher score. (No normalisation needed.)

  Step 4 — Weighted sum:
      accessibility_score = (distance_score × distance_weight)
                          + (time_score     × time_weight)
                          + (risk_score     × risk_weight)

  Final score is clamped to [0, 100] and rounded to 2 decimal places.
""")

    # ------------------------------------------------------------------
    # 5. Show how to import
    # ------------------------------------------------------------------
    section("HOW TO IMPORT (for backend integration)")
    print("""
  from scoring_engine import score_routes

  routes  = [...]        # list of route dicts
  urgency = "HIGH"       # LOW | MEDIUM | HIGH | CRITICAL

  results = score_routes(routes, urgency)

  for r in results:
      print(r.route_id, r.accessibility_score)
""")

    # ------------------------------------------------------------------
    # 6. Edge-case demos
    # ------------------------------------------------------------------
    section("EDGE CASE — Single Route")
    single_route = [
        {
            "route_id": "SOLO",
            "route_name": "Only Available Route",
            "distance_km": 150,
            "estimated_time_min": 200,
            "landslide_risk": 40,
        }
    ]
    single_results = score_routes(single_route, "CRITICAL")
    print("  Input  :", json.dumps(single_route[0], indent=4))
    print("  Output :", asdict(single_results[0]))
    print("  (distance_score = 100, time_score = 100 when only one route exists)")

    section("EDGE CASE — Same Distance for All Routes")
    same_dist = [
        {"route_id": "A", "distance_km": 200, "estimated_time_min": 100, "landslide_risk": 10},
        {"route_id": "B", "distance_km": 200, "estimated_time_min": 200, "landslide_risk": 60},
        {"route_id": "C", "distance_km": 200, "estimated_time_min": 300, "landslide_risk": 80},
    ]
    same_dist_detailed = score_routes_detailed(same_dist, "HIGH")
    print("  All routes have distance_km = 200.")
    print("  Expected: distance_score = 100 for every route.")
    for d in same_dist_detailed:
        print(f"    {d.route_id}: distance_score = {d.distance_score}")

    section("EDGE CASE — Same Travel Time for All Routes")
    same_time = [
        {"route_id": "X", "distance_km": 100, "estimated_time_min": 240, "landslide_risk": 20},
        {"route_id": "Y", "distance_km": 200, "estimated_time_min": 240, "landslide_risk": 50},
    ]
    same_time_detailed = score_routes_detailed(same_time, "MEDIUM")
    print("  All routes have estimated_time_min = 240.")
    print("  Expected: time_score = 100 for every route.")
    for d in same_time_detailed:
        print(f"    {d.route_id}: time_score = {d.time_score}")

    # ------------------------------------------------------------------
    # 7. Urgency comparison
    # ------------------------------------------------------------------
    section("URGENCY COMPARISON — How urgency shifts scores")
    for urg in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        res = score_routes(EXAMPLE_ROUTES, urg)
        scores_str = "  |  ".join(
            f"{r.route_id}: {r.accessibility_score:6.2f}" for r in res
        )
        print(f"  [{urg:8s}]  {scores_str}")

    print(f"\n{SEP}")
    print("  Demo complete. Standalone engine verified.")
    print(SEP + "\n")


if __name__ == "__main__":
    run_demo()
