"""
test_route_service.py
---------------------
MARG SIH — Route Generation Tests (Person 1)

Covers:
  - Guwahati → Silchar
  - Shillong → Imphal
  - Delhi → Jaipur  (arbitrary third pair)
  - Contract field validation (all routes, all pairs)
  - Unique route_id values
  - No hardcoded city restriction (any origin/destination accepted)
  - Mock-mode correctness

Run:
    python test_route_service.py           # live API (needs internet)
    ROUTE_MOCK=1 python test_route_service.py   # offline / CI
"""

import os
import sys
import json
import time
import unittest
import importlib

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _reload_service_with_mock(mock: bool):
    """Reload route_service with ROUTE_MOCK env set appropriately."""
    os.environ["ROUTE_MOCK"] = "1" if mock else "0"
    import route_service
    importlib.reload(route_service)
    return route_service


# ---------------------------------------------------------------------------
# Contract validator (shared by all test cases)
# ---------------------------------------------------------------------------

def _assert_contract(tc: unittest.TestCase, routes: list, label: str = ""):
    """Assert every route satisfies the team output contract."""
    tc.assertIsInstance(routes, list, f"{label}: result must be a list")
    tc.assertGreater(len(routes), 0, f"{label}: must return at least one route")

    seen_ids = set()
    for route in routes:
        rid = route.get("route_id", "<missing>")

        # Required keys
        for key in ("route_id", "origin", "destination", "route_name",
                    "distance_km", "estimated_time_min", "coordinates"):
            tc.assertIn(key, route,
                        f"{label} [{rid}]: missing required key '{key}'")

        # route_id uniqueness
        tc.assertNotIn(rid, seen_ids,
                       f"{label}: duplicate route_id '{rid}'")
        seen_ids.add(rid)

        # route_id format
        tc.assertRegex(rid, r"^R\d+$",
                       f"{label}: route_id must match R<number>, got '{rid}'")

        # Numeric fields
        tc.assertIsInstance(route["distance_km"], (int, float),
                            f"{label} [{rid}]: distance_km must be numeric")
        tc.assertIsInstance(route["estimated_time_min"], (int, float),
                            f"{label} [{rid}]: estimated_time_min must be numeric")

        # Non-negative values
        tc.assertGreaterEqual(route["distance_km"], 0,
                              f"{label} [{rid}]: distance_km must be >= 0")
        tc.assertGreaterEqual(route["estimated_time_min"], 0,
                              f"{label} [{rid}]: estimated_time_min must be >= 0")

        # Coordinates
        coords = route["coordinates"]
        tc.assertIsInstance(coords, list,
                            f"{label} [{rid}]: coordinates must be a list")
        tc.assertGreater(len(coords), 0,
                         f"{label} [{rid}]: coordinates must be non-empty")
        for pt in coords:
            tc.assertIsInstance(pt, dict,
                                f"{label} [{rid}]: each coordinate must be a dict")
            tc.assertIn("lat", pt,
                        f"{label} [{rid}]: coordinate missing 'lat' key")
            tc.assertIn("lon", pt,
                        f"{label} [{rid}]: coordinate missing 'lon' key")
            tc.assertIsInstance(pt["lat"], float,
                                f"{label} [{rid}]: lat must be float")
            tc.assertIsInstance(pt["lon"], float,
                                f"{label} [{rid}]: lon must be float")


# ---------------------------------------------------------------------------
# Mock-mode tests (no internet required)
# ---------------------------------------------------------------------------

class TestMockMode(unittest.TestCase):
    """Verify contract compliance in mock/offline mode."""

    def setUp(self):
        self.svc = _reload_service_with_mock(mock=True)

    def test_mock_returns_list(self):
        result = self.svc.get_routes("Anywhere", "Somewhere")
        self.assertIsInstance(result, list)

    def test_mock_contract(self):
        result = self.svc.get_routes("CityA", "CityB")
        _assert_contract(self, result, label="mock")

    def test_mock_no_hardcoded_city_restriction(self):
        """
        The service must NOT raise for arbitrary origin/destination.
        Verifies there is no hardcoded Guwahati-Silchar check.
        """
        pairs = [
            ("Tokyo", "Osaka"),
            ("New York", "Los Angeles"),
            ("Random City 1", "Random City 2"),
        ]
        for orig, dest in pairs:
            with self.subTest(orig=orig, dest=dest):
                result = self.svc.get_routes(orig, dest)
                self.assertIsInstance(result, list)

    def test_mock_unique_ids(self):
        result = self.svc.get_routes("A", "B")
        ids = [r["route_id"] for r in result]
        self.assertEqual(len(ids), len(set(ids)), "route_id values must be unique")


# ---------------------------------------------------------------------------
# Live API tests (internet required)
# ---------------------------------------------------------------------------

@unittest.skipIf(
    os.environ.get("ROUTE_MOCK", "0") == "1",
    "Skipping live API tests in mock mode"
)
class TestLiveAPI(unittest.TestCase):
    """
    Integration tests against real OSRM + Nominatim APIs.
    These require an internet connection.
    OSRM public demo server limits: ~1 request/second.
    We add delays between test cases to stay polite.
    """

    DELAY_BETWEEN_TESTS = 2.0  # seconds

    def setUp(self):
        self.svc = _reload_service_with_mock(mock=False)
        time.sleep(self.DELAY_BETWEEN_TESTS)

    # ---- Required test pairs ----

    def test_guwahati_to_silchar(self):
        """Required: Guwahati → Silchar (same state, verifiable distance ~350 km)."""
        routes = self.svc.get_routes("Guwahati, Assam", "Silchar, Assam")
        _assert_contract(self, routes, label="Guwahati→Silchar")

        # Sanity check on distance (rough bounds)
        for r in routes:
            self.assertGreater(r["distance_km"], 50,
                               "distance_km implausibly small for Guwahati->Silchar")
            self.assertLess(r["distance_km"], 1000,
                            "distance_km implausibly large for Guwahati->Silchar")
            self.assertGreater(r["estimated_time_min"], 30,
                               "estimated_time_min implausibly small")

        print(f"\n[Guwahati->Silchar] {len(routes)} route(s) returned:")
        for r in routes:
            print(f"  {r['route_id']}: {r['distance_km']} km, "
                  f"{r['estimated_time_min']} min, "
                  f"{len(r['coordinates'])} waypoints")

    def test_shillong_to_imphal(self):
        """Required: Shillong -> Imphal."""
        routes = self.svc.get_routes("Shillong, Meghalaya", "Imphal, Manipur")
        _assert_contract(self, routes, label="Shillong->Imphal")

        print(f"\n[Shillong->Imphal] {len(routes)} route(s) returned:")
        for r in routes:
            print(f"  {r['route_id']}: {r['distance_km']} km, "
                  f"{r['estimated_time_min']} min, "
                  f"{len(r['coordinates'])} waypoints")

    def test_delhi_to_jaipur(self):
        """Third arbitrary pair: Delhi -> Jaipur (well-known highway, ~280 km)."""
        routes = self.svc.get_routes("New Delhi", "Jaipur, Rajasthan")
        _assert_contract(self, routes, label="Delhi->Jaipur")

        for r in routes:
            self.assertGreater(r["distance_km"], 100,
                               "distance_km implausibly small for Delhi->Jaipur")
            self.assertLess(r["distance_km"], 600,
                            "distance_km implausibly large for Delhi->Jaipur")

        print(f"\n[Delhi->Jaipur] {len(routes)} route(s) returned:")
        for r in routes:
            print(f"  {r['route_id']}: {r['distance_km']} km, "
                  f"{r['estimated_time_min']} min, "
                  f"{len(r['coordinates'])} waypoints")

    # ---- Contract shape ----

    def test_route_id_format(self):
        """route_id values must be R1, R2, R3 … (never mixed or reused)."""
        routes = self.svc.get_routes("Mumbai", "Pune")
        ids = [r["route_id"] for r in routes]
        for i, rid in enumerate(ids, start=1):
            self.assertEqual(rid, f"R{i}",
                             f"Expected R{i}, got '{rid}'")

    def test_no_hardcoded_restriction(self):
        """Service must accept ANY valid origin/destination, not just NE India."""
        routes = self.svc.get_routes("London", "Edinburgh")
        _assert_contract(self, routes, label="London->Edinburgh")

    def test_multiple_routes_when_available(self):
        """
        OSRM returns alternatives=true; verify we propagate them.
        Not guaranteed for all pairs, but log the count.
        """
        routes = self.svc.get_routes("Guwahati, Assam", "Silchar, Assam")
        print(f"\n[alternatives check] {len(routes)} route(s) for Guwahati->Silchar")
        # Contract: at least 1 route must exist
        self.assertGreaterEqual(len(routes), 1)

    def test_full_json_output(self):
        """Pretty-print real contract output for manual inspection."""
        routes = self.svc.get_routes("Guwahati, Assam", "Silchar, Assam")
        # Trim coordinates for readability (first + last 2 points)
        compact = []
        for r in routes:
            trimmed = dict(r)
            coords = r["coordinates"]
            trimmed["coordinates"] = (
                coords[:2] + ["..."] + coords[-2:]
                if len(coords) > 4 else coords
            )
            compact.append(trimmed)
        print("\n[Contract output sample]")
        print(json.dumps(compact, indent=2))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("MARG SIH Route Service — Test Suite")
    print(f"Mode: {'MOCK' if os.environ.get('ROUTE_MOCK', '0') == '1' else 'LIVE API'}")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Always run mock tests
    suite.addTests(loader.loadTestsFromTestCase(TestMockMode))

    # Run live tests only when not in mock mode
    if os.environ.get("ROUTE_MOCK", "0") != "1":
        suite.addTests(loader.loadTestsFromTestCase(TestLiveAPI))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
