import unittest
from fastapi.testclient import TestClient
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from main import app

client = TestClient(app)

class TestBackendPipeline(unittest.TestCase):
    def test_health_check(self):
        resp = client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"status": "MARG Backend Running"})

    def test_routes_demo_catalogue(self):
        resp = client.get("/routes")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("routes", data)
        self.assertGreater(data["total"], 0)

    def test_route_by_id(self):
        resp = client.get("/routes/R1")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["route_id"], "R1")

    def test_route_by_invalid_id(self):
        resp = client.get("/routes/R99999")
        self.assertEqual(resp.status_code, 404)

    def test_recommend_validation_missing_fields(self):
        resp = client.post("/recommend-route", json={"origin": ""})
        self.assertEqual(resp.status_code, 422)

    def test_recommend_validation_same_origin_dest(self):
        resp = client.post("/recommend-route", json={"origin": "Guwahati", "destination": "Guwahati"})
        self.assertEqual(resp.status_code, 422)

    def test_waterlogging_service_math(self):
        from services.waterlogging_service import calculate_waterlogging_risk
        # Test baseline zero: (rain24=0, rain7d=0, flat_pct=0, drainage=0)
        res0 = calculate_waterlogging_risk(0.0, 0.0, 0.0, 0.0)
        self.assertEqual(res0["waterlogging_risk"], 0.0)
        self.assertEqual(res0["waterlogging_level"], "LOW")
        self.assertEqual(res0["waterlogging_factors"]["rainfall_pressure"], 0.0)

        # Test extreme values
        res_max = calculate_waterlogging_risk(100.0, 200.0, 100.0, 100.0)
        self.assertEqual(res_max["waterlogging_risk"], 100.0)
        self.assertEqual(res_max["waterlogging_level"], "HIGH")

        # Test custom weighting: 45% rain24 + 30% flat + 15% drainage + 10% sat7d
        # rain24: 30mm -> 50%
        # flat: 50% -> 50%
        # drainage: 40% -> 40%
        # sat7d: 75mm -> 50%
        # expected: 0.45*50 + 0.30*50 + 0.15*40 + 0.10*50 = 22.5 + 15.0 + 6.0 + 5.0 = 48.5
        res_mid = calculate_waterlogging_risk(30.0, 75.0, 50.0, 40.0)
        self.assertAlmostEqual(res_mid["waterlogging_risk"], 48.5, places=2)
        self.assertEqual(res_mid["waterlogging_level"], "MEDIUM")

    def test_terrain_waterlogging_metrics(self):
        from services.environmental_service import compute_terrain_waterlogging_metrics
        # Test flat coordinates
        coords = [
            {"lat": 26.1445, "lon": 91.7362},
            {"lat": 26.1450, "lon": 91.7370},
            {"lat": 26.1460, "lon": 91.7380},
        ]
        metrics = compute_terrain_waterlogging_metrics(coords)
        self.assertIn("average_slope_deg", metrics)
        self.assertIn("flat_segments_pct", metrics)
        self.assertIn("drainage_depression_score", metrics)
        self.assertTrue(0.0 <= metrics["flat_segments_pct"] <= 100.0)
        self.assertTrue(0.0 <= metrics["drainage_depression_score"] <= 100.0)

    def test_recommend_guwahati_silchar(self):
        resp = client.post("/recommend-route", json={"origin": "Guwahati", "destination": "Silchar", "urgency": "HIGH"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("routes", data)
        self.assertGreater(len(data["routes"]), 0)
        for r in data["routes"]:
            self.assertIn("landslide_risk", r)
            self.assertIn("risk_level", r)
            self.assertIn("waterlogging_risk", r)
            self.assertIn("waterlogging_level", r)
            self.assertIn("waterlogging_factors", r)
            self.assertIn("combined_hazard_risk", r)
            self.assertIn("accessibility_score", r)

            # Check math: combined_hazard_risk = (1 - (1 - L)*(1 - W)) * 100
            l_prob = r["landslide_risk"] / 100.0
            w_prob = r["waterlogging_risk"] / 100.0
            expected_combined = round((1.0 - (1.0 - l_prob) * (1.0 - w_prob)) * 100.0, 2)
            self.assertAlmostEqual(r["combined_hazard_risk"], expected_combined, places=2)

    def test_recommend_guwahati_tezpur(self):
        resp = client.post("/recommend-route", json={"origin": "Guwahati", "destination": "Tezpur", "urgency": "MEDIUM"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("routes", data)
        self.assertGreater(len(data["routes"]), 0)
        for r in data["routes"]:
            self.assertIn("waterlogging_risk", r)
            self.assertIn("combined_hazard_risk", r)

    def test_emergency_reroute_waterlogging(self):
        resp = client.post("/reroute", json={
            "current_location": {"lat": 26.1445, "lon": 91.7362},
            "destination": "Tezpur, Assam",
            "blocked_location": {"lat": 26.2500, "lon": 91.8500},
            "urgency": "HIGH"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("routes", data)
        self.assertGreater(len(data["routes"]), 0)
        for r in data["routes"]:
            self.assertIn("waterlogging_risk", r)
            self.assertIn("waterlogging_level", r)
            self.assertIn("waterlogging_factors", r)
            self.assertIn("combined_hazard_risk", r)
            self.assertIn("accessibility_score", r)

    def test_combined_hazard_formula(self):
        # Example from spec: landslide = 20, waterlogging = 30
        l_prob = 20.0 / 100.0
        w_prob = 30.0 / 100.0
        combined = round((1.0 - (1.0 - l_prob) * (1.0 - w_prob)) * 100.0, 2)
        # Expected: (1 - 0.8 * 0.7) * 100 = (1 - 0.56) * 100 = 44.0
        self.assertEqual(combined, 44.0)

    def test_scoring_backward_compatibility(self):
        from services.scoring_service import score_routes
        # Route with only landslide_risk
        routes_legacy = [{
            "route_id": "R_LEGACY",
            "distance_km": 100.0,
            "estimated_time_min": 60.0,
            "landslide_risk": 20.0,
        }]
        scores_legacy = score_routes(routes_legacy, urgency="MEDIUM")
        self.assertIn("R_LEGACY", scores_legacy)
        self.assertTrue(0.0 <= scores_legacy["R_LEGACY"] <= 100.0)

        # Route with combined_hazard_risk
        routes_combined = [{
            "route_id": "R_COMBINED",
            "distance_km": 100.0,
            "estimated_time_min": 60.0,
            "landslide_risk": 20.0,
            "combined_hazard_risk": 44.0,
        }]
        scores_combined = score_routes(routes_combined, urgency="MEDIUM")
        self.assertIn("R_COMBINED", scores_combined)
        # Because combined hazard risk is higher (44 > 20), accessibility score should be lower
        self.assertLess(scores_combined["R_COMBINED"], scores_legacy["R_LEGACY"])

    def test_waterlogging_factor_bounds_and_classification(self):
        from services.waterlogging_service import calculate_waterlogging_risk
        # Out-of-bounds inputs should be clamped cleanly
        res_negative = calculate_waterlogging_risk(-50.0, -100.0, -20.0, -10.0)
        self.assertEqual(res_negative["waterlogging_risk"], 0.0)
        self.assertEqual(res_negative["waterlogging_level"], "LOW")
        self.assertEqual(res_negative["waterlogging_factors"]["rainfall_pressure"], 0.0)
        self.assertEqual(res_negative["waterlogging_factors"]["flat_terrain"], 0.0)

        # Huge values should clamp to 100.0 and HIGH
        res_huge = calculate_waterlogging_risk(500.0, 1000.0, 200.0, 300.0)
        self.assertEqual(res_huge["waterlogging_risk"], 100.0)
        self.assertEqual(res_huge["waterlogging_level"], "HIGH")

    def test_route_ranking_flipped_by_waterlogging(self):
        """
        Prove that severe waterlogging risk changes route recommendation ranking
        even when a corridor has low landslide risk.
        """
        from services.scoring_service import score_routes_detailed

        # Case: R1 is faster/shorter but suffers 75% waterlogging (combined 76.25%)
        # R2 is slightly longer but safe on both hazards (combined 19.00%)
        # R3 is distant
        routes = [
            {
                "route_id": "R1_WATERLOGGED",
                "distance_km": 150.0,
                "estimated_time_min": 120.0,
                "landslide_risk": 5.0,
                "combined_hazard_risk": 76.25,
            },
            {
                "route_id": "R2_SAFE",
                "distance_km": 155.0,
                "estimated_time_min": 125.0,
                "landslide_risk": 10.0,
                "combined_hazard_risk": 19.00,
            },
            {
                "route_id": "R3_DISTANT",
                "distance_km": 190.0,
                "estimated_time_min": 160.0,
                "landslide_risk": 15.0,
                "combined_hazard_risk": 27.75,
            }
        ]
        scored = score_routes_detailed(routes, urgency="MEDIUM")
        # R2_SAFE score should be higher than R1_WATERLOGGED score
        self.assertGreater(scored["R2_SAFE"]["accessibility_score"], scored["R1_WATERLOGGED"]["accessibility_score"])

    # ── VEHICLE-TYPE TESTS ───────────────────────────────────────────────────

    def test_vehicle_service_profiles_and_suitability(self):
        from services.vehicle_service import calculate_vehicle_suitability, VEHICLE_PROFILES

        # Test CAR on gentle slope (10 deg <= 35 deg max)
        r_gentle = {"route_id": "R_GENTLE", "average_slope_deg": 10.0}
        car_res = calculate_vehicle_suitability(r_gentle, "CAR")
        self.assertEqual(car_res["vehicle_type"], "CAR")
        self.assertTrue(car_res["vehicle_compatible"])
        # Expected suitability = 100 - 40 * (10 / 35) = 100 - 11.43 = 88.57
        self.assertAlmostEqual(car_res["vehicle_suitability"], 88.57, places=1)
        self.assertIn("suitable", car_res["vehicle_reason"].lower())

        # Test TRUCK on steep slope (25 deg > 20 deg max)
        r_steep = {"route_id": "R_STEEP", "average_slope_deg": 25.0}
        truck_res = calculate_vehicle_suitability(r_steep, "TRUCK")
        self.assertEqual(truck_res["vehicle_type"], "TRUCK")
        self.assertFalse(truck_res["vehicle_compatible"])
        # Expected suitability = max(0, 60 - 60 * (5 / 20)) = 60 - 15 = 45.0
        self.assertAlmostEqual(truck_res["vehicle_suitability"], 45.0, places=1)
        self.assertIn("exceeds", truck_res["vehicle_reason"].lower())

        # Test all profiles exist
        for v in ["CAR", "BIKE", "SUV", "BUS", "TRUCK", "AMBULANCE"]:
            self.assertIn(v, VEHICLE_PROFILES)
            res = calculate_vehicle_suitability(r_gentle, v)
            self.assertEqual(res["vehicle_type"], v)
            self.assertTrue(0.0 <= res["vehicle_suitability"] <= 100.0)

    def test_vehicle_aware_formula_math(self):
        from services.vehicle_service import apply_vehicle_evaluation
        routes = [
            {
                "route_id": "R1",
                "accessibility_score": 90.0,
                "average_slope_deg": 10.0,  # CAR max 35 -> suit 88.57
            },
            {
                "route_id": "R2",
                "accessibility_score": 85.0,
                "average_slope_deg": 30.0,  # CAR max 35 -> suit 65.71
            }
        ]
        evaluated = apply_vehicle_evaluation(routes, "CAR")
        for r in evaluated:
            expected = round(0.8 * r["accessibility_score"] + 0.2 * r["vehicle_suitability"], 2)
            self.assertEqual(r["vehicle_aware_score"], expected)

    def test_vehicle_recommend_car_api(self):
        resp = client.post("/recommend-route", json={
            "origin": "Guwahati",
            "destination": "Silchar",
            "urgency": "HIGH",
            "vehicle_type": "CAR"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["vehicle_type"], "CAR")
        self.assertIn("recommended_route", data)
        self.assertIn("routes", data)
        for r in data["routes"]:
            self.assertEqual(r["vehicle_type"], "CAR")
            self.assertIn("vehicle_suitability", r)
            self.assertIn("vehicle_compatible", r)
            self.assertIn("vehicle_reason", r)
            self.assertIn("vehicle_aware_score", r)
            self.assertTrue(0.0 <= r["vehicle_suitability"] <= 100.0)
            self.assertTrue(0.0 <= r["vehicle_aware_score"] <= 100.0)

    def test_vehicle_recommend_truck_api(self):
        resp = client.post("/recommend-route", json={
            "origin": "Guwahati",
            "destination": "Silchar",
            "urgency": "HIGH",
            "vehicle_type": "TRUCK"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["vehicle_type"], "TRUCK")
        for r in data["routes"]:
            self.assertEqual(r["vehicle_type"], "TRUCK")
            expected_score = round(0.8 * r["accessibility_score"] + 0.2 * r["vehicle_suitability"], 2)
            self.assertAlmostEqual(r["vehicle_aware_score"], expected_score, places=2)

    def test_vehicle_recommend_ambulance_critical_api(self):
        resp = client.post("/recommend-route", json={
            "origin": "Guwahati",
            "destination": "Silchar",
            "urgency": "CRITICAL",
            "vehicle_type": "AMBULANCE"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["vehicle_type"], "AMBULANCE")

    def test_invalid_vehicle_type(self):
        resp = client.post("/recommend-route", json={
            "origin": "Guwahati",
            "destination": "Silchar",
            "urgency": "HIGH",
            "vehicle_type": "PLANE"
        })
        self.assertEqual(resp.status_code, 422)

    def test_vehicle_type_case_insensitivity(self):
        resp = client.post("/recommend-route", json={
            "origin": "Guwahati",
            "destination": "Silchar",
            "urgency": "HIGH",
            "vehicle_type": "truck"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["vehicle_type"], "TRUCK")

    def test_vehicle_recommendation_ranking_flip(self):
        """
        Verify that vehicle suitability can prioritize a gentler corridor for TRUCK
        even when a steeper corridor had a slightly higher raw accessibility score.
        """
        from services.vehicle_service import apply_vehicle_evaluation

        # R1: raw accessibility = 90.0, but slope is 25.0 deg (incompatible with TRUCK max 20)
        # TRUCK suitability = max(0, 60 - 60*(5/20)) = 45.0
        # vehicle_aware_score = 0.8 * 90 + 0.2 * 45 = 72 + 9 = 81.0, vehicle_compatible = False

        # R2: raw accessibility = 85.0, slope is 5.0 deg (compatible with TRUCK max 20)
        # TRUCK suitability = 100 - 40*(5/20) = 90.0
        # vehicle_aware_score = 0.8 * 85 + 0.2 * 90 = 68 + 18 = 86.0, vehicle_compatible = True

        routes = [
            {
                "route_id": "R1_STEEP",
                "accessibility_score": 90.0,
                "average_slope_deg": 25.0,
            },
            {
                "route_id": "R2_GENTLE",
                "accessibility_score": 85.0,
                "average_slope_deg": 5.0,
            }
        ]

        evaluated = apply_vehicle_evaluation(routes, "TRUCK")
        # R2_GENTLE should be the top ranked and recommended route for TRUCK
        self.assertEqual(evaluated[0]["route_id"], "R2_GENTLE")
        self.assertTrue(evaluated[0]["recommended"])
        self.assertFalse(evaluated[1]["recommended"])
        self.assertTrue(evaluated[0]["vehicle_compatible"])
        self.assertFalse(evaluated[1]["vehicle_compatible"])

if __name__ == "__main__":
    unittest.main()


