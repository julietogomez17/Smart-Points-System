
from pathlib import Path
import joblib
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = (
    BASE_DIR / "MODEL"
    / "citipoints_fraud_model_dynamic_radius.pkl"
)

bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
features = bundle["features"]

def test_claim(radius, distance, duplicates=0):
    claim = {
        "points_claimed": 50,
        "claims_last_24h": 1,
        "user_claims_7d": 3,
        "rejected_claims_30d": 0,
        "same_activity_claims": 1,
        "duplicate_proof_count": duplicates,
        "proof_reuse_count": duplicates,
        "submission_delay_minutes": 45,
        "location_mismatch": int(distance > radius),
        "rapid_submission": 0,
        "account_age_days": 200,
        "prior_approved_claims": 10,
        "gps_available": 1,
        "gps_distance_meters": distance,
        "event_radius_meters": radius,
        "gps_distance_ratio": distance / radius,
        "gps_accuracy_meters": 10
    }

    X = np.array(
        [[claim[name] for name in features]],
        dtype=float
    )

    probability = model.predict_proba(X)[0]
    index = list(model.classes_).index(1)

    print(f"\nEvent Radius: {radius} meters")
    print(f"Photo Distance: {distance} meters")
    print(f"Duplicate Proofs: {duplicates}")
    print(f"Review Score: {probability[index]*100:.2f}%")
    print(
        "GPS Status:",
        "OUTSIDE" if distance > radius else "INSIDE"
    )

test_claim(100, 30)
test_claim(100, 150)
test_claim(100, 5000)
test_claim(1000, 500)
test_claim(100, 30, duplicates=3)

print("\n" + "=" * 55)
print("MISSING GPS AND PREVIOUS REJECTION TESTS")
print("=" * 55)

def test_risk_scenario(name, missing_gps=False, rejections=0):
    radius = 500.0
    distance = -1.0 if missing_gps else 50.0

    claim = {
        "points_claimed": 50,
        "claims_last_24h": 1,
        "user_claims_7d": 3,
        "rejected_claims_30d": rejections,
        "same_activity_claims": 1,
        "duplicate_proof_count": 0,
        "proof_reuse_count": 0,
        "submission_delay_minutes": 45,
        "location_mismatch": 0,
        "rapid_submission": 0,
        "account_age_days": 200,
        "prior_approved_claims": 10,
        "gps_available": 0 if missing_gps else 1,
        "gps_distance_meters": distance,
        "event_radius_meters": radius,
        "gps_distance_ratio": -1.0 if missing_gps else distance / radius,
        "gps_accuracy_meters": -1.0 if missing_gps else 10.0
    }

    X = np.array(
        [[claim[feature] for feature in features]],
        dtype=float
    )

    probability = model.predict_proba(X)[0]
    index = list(model.classes_).index(1)
    score = probability[index] * 100

    print(f"\nScenario: {name}")
    print(f"Previous Rejections: {rejections}")
    print(f"Missing GPS: {missing_gps}")
    print(f"AI Risk Score: {score:.2f}%")


test_risk_scenario("Normal submission")
test_risk_scenario("Missing GPS", missing_gps=True)
test_risk_scenario("One previous rejection", rejections=1)
test_risk_scenario(
    "Missing GPS + previous rejection",
    missing_gps=True,
    rejections=1
)