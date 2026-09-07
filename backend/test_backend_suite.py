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

    def test_recommend_validation_invalid_urgency(self):
        resp = client.post("/recommend-route", json={"origin": "Guwahati", "destination": "Silchar", "urgency": "EXTREME"})
        self.assertEqual(resp.status_code, 422)

if __name__ == "__main__":
    unittest.main()
