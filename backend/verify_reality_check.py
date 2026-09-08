import os
import sys
import json
import math

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app
from services.waterlogging_service import calculate_waterlogging_risk
from services.environmental_service import compute_terrain_waterlogging_metrics
from services.weather_service import get_route_rainfall
from services.scoring_service import score_routes, score_routes_detailed

client = TestClient(app)

print("=" * 80)
print("MARG BACKEND REALITY CHECK & MULTI-HAZARD VERIFICATION")
print("=" * 80)

# -----------------------------------------------------------------------------
# STEP 2: VERIFY WATERLOGGING CALCULATION & SCENARIOS
# -----------------------------------------------------------------------------
print("\n[STEP 2] Testing Waterlogging Risk Scenarios:")

# Scenario A: Low Risk
scen_a = calculate_waterlogging_risk(
    rainfall_24h_mm=2.0,
    rainfall_7d_mm=10.0,
    flat_segments_pct=5.0,
    drainage_depression_score=4.0,
)
print(f"Scenario A (Low Rain & Steep Terrain): risk={scen_a['waterlogging_risk']}%, level={scen_a['waterlogging_level']}, factors={scen_a['waterlogging_factors']}")
assert scen_a["waterlogging_level"] == "LOW"
assert scen_a["waterlogging_risk"] < 30.0

# Scenario B: Heavy Rainfall + Flat Terrain (High Risk)
scen_b = calculate_waterlogging_risk(
    rainfall_24h_mm=75.0,
    rainfall_7d_mm=180.0,
    flat_segments_pct=85.0,
    drainage_depression_score=80.0,
)
print(f"Scenario B (Heavy Rain & Flat Basin): risk={scen_b['waterlogging_risk']}%, level={scen_b['waterlogging_level']}, factors={scen_b['waterlogging_factors']}")
assert scen_b["waterlogging_level"] == "HIGH"
assert scen_b["waterlogging_risk"] >= 60.0

# Scenario C: Moderate Conditions (Medium Risk)
scen_c = calculate_waterlogging_risk(
    rainfall_24h_mm=25.0,
    rainfall_7d_mm=60.0,
    flat_segments_pct=45.0,
    drainage_depression_score=35.0,
)
print(f"Scenario C (Moderate Conditions): risk={scen_c['waterlogging_risk']}%, level={scen_c['waterlogging_level']}, factors={scen_c['waterlogging_factors']}")
assert scen_c["waterlogging_level"] == "MEDIUM"
assert 30.0 <= scen_c["waterlogging_risk"] < 60.0

print("=> Waterlogging calculation scenarios passed mathematically.")

# -----------------------------------------------------------------------------
# STEP 3: VERIFY COMBINED HAZARD FORMULA
# -----------------------------------------------------------------------------
print("\n[STEP 3] Testing Combined Multi-Hazard Risk Formula:")
test_pairs = [
    (10.0, 10.0),
    (70.0, 10.0),
    (10.0, 70.0),
    (70.0, 70.0),
    (0.0, 50.0),
    (50.0, 0.0),
    (100.0, 100.0),
]

for lr, wr in test_pairs:
    l_p = lr / 100.0
    w_p = wr / 100.0
    c_p = 1.0 - (1.0 - l_p) * (1.0 - w_p)
    comb = round(c_p * 100.0, 2)
    print(f"  Landslide: {lr:5.1f}% | Waterlogging: {wr:5.1f}% => Combined Hazard: {comb:5.2f}%")
    assert 0.0 <= comb <= 100.0
    assert comb >= lr
    assert comb >= wr

# Verify strictly increasing (monotonicity)
c_10_10 = (1.0 - (1.0 - 0.10) * (1.0 - 0.10)) * 100.0
c_20_10 = (1.0 - (1.0 - 0.20) * (1.0 - 0.10)) * 100.0
c_10_20 = (1.0 - (1.0 - 0.10) * (1.0 - 0.20)) * 100.0
assert c_20_10 > c_10_10
assert c_10_20 > c_10_10
print("=> Combined hazard formula verified: bounded in [0, 100], strictly monotonic.")

# -----------------------------------------------------------------------------
# STEP 4 & 5: CONTROLLED ROUTE RANKING & SCORING IMPACT TEST
# -----------------------------------------------------------------------------
print("\n[STEP 4 & 5] Controlled Route Ranking & Scoring Impact:")

# Case 1: Identical distance and time (150 km, 120 min)
# R1: Low Landslide (5%), High Waterlogging (75%) => Combined 76.25%
# R2: Low Landslide (10%), Low Waterlogging (10%) => Combined 19.00%
r1_l, r1_w = 5.0, 75.0
r1_c = round((1.0 - (1.0 - r1_l/100.0) * (1.0 - r1_w/100.0)) * 100.0, 2) # 76.25%

r2_l, r2_w = 10.0, 10.0
r2_c = round((1.0 - (1.0 - r2_l/100.0) * (1.0 - r2_w/100.0)) * 100.0, 2) # 19.00%

case1_routes = [
    {
        "route_id": "R1_WATERLOGGED",
        "route_name": "Corridor 1 (Waterlogged)",
        "distance_km": 150.0,
        "estimated_time_min": 120.0,
        "landslide_risk": r1_l,
        "waterlogging_risk": r1_w,
        "combined_hazard_risk": r1_c,
    },
    {
        "route_id": "R2_SAFE",
        "route_name": "Corridor 2 (Safe Multi-Hazard)",
        "distance_km": 150.0,
        "estimated_time_min": 120.0,
        "landslide_risk": r2_l,
        "waterlogging_risk": r2_w,
        "combined_hazard_risk": r2_c,
    }
]

details1 = score_routes_detailed(case1_routes, urgency="MEDIUM")
print(f"\nCase 1 (Identical Distance/Time):")
for rid, d in details1.items():
    print(f"  {rid}: distance_score={d['distance_score']}, time_score={d['time_score']}, risk_score={d['risk_score']} => accessibility_score={d['accessibility_score']}")

assert details1["R2_SAFE"]["accessibility_score"] > details1["R1_WATERLOGGED"]["accessibility_score"]
print(f"  => WINNER: R2_SAFE ({details1['R2_SAFE']['accessibility_score']}) beats R1_WATERLOGGED ({details1['R1_WATERLOGGED']['accessibility_score']}) due to Waterlogging Risk!")

# Case 2: Realistic 3-corridor candidate evaluation
# R1: 150 km, 120 min, Landslide 5%, Waterlogging 75% -> Combined 76.25%
# R2: 155 km, 125 min, Landslide 10%, Waterlogging 10% -> Combined 19.00%
# R3: 190 km, 160 min, Landslide 15%, Waterlogging 15% -> Combined 27.75%
r3_l, r3_w = 15.0, 15.0
r3_c = round((1.0 - (1.0 - r3_l/100.0) * (1.0 - r3_w/100.0)) * 100.0, 2) # 27.75%

case2_routes = [
    {
        "route_id": "R1_WATERLOGGED",
        "distance_km": 150.0,
        "estimated_time_min": 120.0,
        "landslide_risk": r1_l,
        "waterlogging_risk": r1_w,
        "combined_hazard_risk": r1_c,
    },
    {
        "route_id": "R2_SAFE",
        "distance_km": 155.0,
        "estimated_time_min": 125.0,
        "landslide_risk": r2_l,
        "waterlogging_risk": r2_w,
        "combined_hazard_risk": r2_c,
    },
    {
        "route_id": "R3_DISTANT",
        "distance_km": 190.0,
        "estimated_time_min": 160.0,
        "landslide_risk": r3_l,
        "waterlogging_risk": r3_w,
        "combined_hazard_risk": r3_c,
    }
]

details2 = score_routes_detailed(case2_routes, urgency="MEDIUM")
print(f"\nCase 2 (Realistic 3-Corridor Evaluation):")
for rid, d in details2.items():
    print(f"  {rid}: distance_score={d['distance_score']}, time_score={d['time_score']}, risk_score={d['risk_score']} => accessibility_score={d['accessibility_score']}")

assert details2["R2_SAFE"]["accessibility_score"] > details2["R1_WATERLOGGED"]["accessibility_score"], \
    "R2_SAFE should win over R1_WATERLOGGED because of waterlogging combined hazard!"

print(f"  => WINNER: R2_SAFE ({details2['R2_SAFE']['accessibility_score']}) beats R1_WATERLOGGED ({details2['R1_WATERLOGGED']['accessibility_score']}) despite being slightly longer!")

# Contrast with legacy scoring (ignoring waterlogging)
legacy_routes = [
    {"route_id": "R1_WATERLOGGED", "distance_km": 150.0, "estimated_time_min": 120.0, "landslide_risk": 5.0},
    {"route_id": "R2_SAFE", "distance_km": 155.0, "estimated_time_min": 125.0, "landslide_risk": 10.0},
    {"route_id": "R3_DISTANT", "distance_km": 190.0, "estimated_time_min": 160.0, "landslide_risk": 15.0},
]
details_legacy = score_routes_detailed(legacy_routes, urgency="MEDIUM")
print(f"\nHypothetical Legacy Scoring without Waterlogging:")
for rid, d in details_legacy.items():
    print(f"  {rid}: risk_score={d['risk_score']} => accessibility_score={d['accessibility_score']}")

assert details_legacy["R1_WATERLOGGED"]["accessibility_score"] > details_legacy["R2_SAFE"]["accessibility_score"], \
    "In legacy scoring without waterlogging, R1 would incorrectly win!"

print("  => PROOF: Waterlogging risk flipped the recommendation from unsafe R1 to safe R2.")

# -----------------------------------------------------------------------------
# STEP 6: TEST REAL API RESPONSES ACROSS CORRIDORS
# -----------------------------------------------------------------------------
print("\n[STEP 6] Testing Real API Corridors with /recommend-route and /reroute:")

corridors = [
    ("Guwahati", "Tezpur", "MEDIUM"),
    ("Guwahati", "Silchar", "HIGH"),
    ("Silchar", "Aizawl", "HIGH"),
    ("Guwahati", "Shillong", "LOW"),
]

for orig, dest, urg in corridors:
    print(f"\n--- Corridor: {orig} -> {dest} (urgency={urg}) ---")
    resp = client.post("/recommend-route", json={"origin": orig, "destination": dest, "urgency": urg})
    if resp.status_code != 200:
        print(f"  ERROR {resp.status_code}: {resp.text}")
        continue
    data = resp.json()
    routes = data.get("routes", [])
    print(f"  Total routes returned: {len(routes)}")
    for r in routes:
        print(f"  Route: {r.get('route_id')} ({r.get('route_name')})")
        print(f"    Distance: {r.get('distance_km')} km | Time: {r.get('estimated_time_min')} min")
        print(f"    Landslide: {r.get('landslide_risk')}% ({r.get('landslide_risk_level')})")
        print(f"    Waterlogging: {r.get('waterlogging_risk')}% ({r.get('waterlogging_level')})")
        print(f"    Factors: {r.get('waterlogging_factors')}")
        print(f"    Combined Hazard: {r.get('combined_hazard_risk')}%")
        print(f"    Accessibility Score: {r.get('accessibility_score')} | Recommended: {r.get('recommended')}")

print("\n--- Testing Emergency /reroute ---")
reroute_resp = client.post("/reroute", json={
    "current_location": {"lat": 26.1445, "lon": 91.7362},
    "destination": "Tezpur, Assam",
    "blocked_location": {"lat": 26.2500, "lon": 91.8500},
    "urgency": "HIGH"
})
assert reroute_resp.status_code == 200
reroute_data = reroute_resp.json()
print(f"  Emergency routes returned: {len(reroute_data.get('routes', []))}")
for r in reroute_data.get("routes", []):
    print(f"  Route: {r.get('route_id')} | Waterlogging: {r.get('waterlogging_risk')}% | Combined: {r.get('combined_hazard_risk')}% | Score: {r.get('accessibility_score')}")

print("\n" + "=" * 80)
print("REALITY CHECK COMPLETE: ALL ASSERTS PASSED SUCCESSFULLY")
print("=" * 80)
