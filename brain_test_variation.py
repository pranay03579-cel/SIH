import urllib.request
import json

routes_to_test = [
    ("Guwahati, Assam, India", "Tezpur, Assam, India", "MEDIUM"),
    ("Guwahati, Assam, India", "Tezpur, Assam, India", "HIGH"),
    ("Guwahati, Assam, India", "Shillong, Meghalaya, India", "MEDIUM"),
    ("Guwahati, Assam, India", "Silchar, Assam, India", "MEDIUM"),
    ("Silchar, Assam, India", "Aizawl, Mizoram, India", "MEDIUM"),
    ("Guwahati, Assam, India", "Itanagar, Arunachal Pradesh, India", "MEDIUM"),
]

print("="*80)
print("MARG CORRIDOR SCORING AUDIT - RUNTIME REALITY CHECK")
print("="*80)

for orig, dest, urg in routes_to_test:
    payload = {"origin": orig, "destination": dest, "urgency": urg}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/recommend-route",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            routes = res.get("routes", [])
            rec_id = res.get("recommended_route_id")
            print(f"\nCorridor: {orig} -> {dest} [{urg}]", flush=True)
            print(f"Total Corridors: {len(routes)} | Recommended: {rec_id}", flush=True)
            for r in routes:
                print(f"  * [{r['route_id']}] {r['route_name']}: Distance={r['distance_km']} km, Time={r['estimated_time_min']} min, Risk={r['landslide_risk']}% ({r['risk_level']}), Score={r['accessibility_score']}/100 [D_score={r.get('distance_score')}, T_score={r.get('time_score')}, R_score={r.get('risk_score')}]", flush=True)
    except Exception as e:
        print(f"\nCorridor: {orig} -> {dest} [{urg}] FAILED: {e}", flush=True)
