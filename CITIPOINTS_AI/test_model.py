import joblib
import pandas as pd


# ==========================================
# LOAD TRAINED MODEL
# ==========================================

model = joblib.load(
    "MODEL/citipoints_fraud_model.pkl"
)

print("CITIPOINTS AI MODEL LOADED SUCCESSFULLY!")


# ==========================================
# FEATURES
# ==========================================

features = [
    "points_claimed",
    "claims_last_24h",
    "user_claims_7d",
    "rejected_claims_30d",
    "same_activity_claims",
    "duplicate_proof_count",
    "proof_reuse_count",
    "submission_delay_minutes",
    "location_mismatch",
    "rapid_submission",
    "account_age_days",
    "prior_approved_claims"
]


# ==========================================
# NORMAL TEST CLAIM
# ==========================================

normal_claim = pd.DataFrame([{
    "points_claimed": 50,
    "claims_last_24h": 1,
    "user_claims_7d": 3,
    "rejected_claims_30d": 0,
    "same_activity_claims": 1,
    "duplicate_proof_count": 0,
    "proof_reuse_count": 0,
    "submission_delay_minutes": 45,
    "location_mismatch": 0,
    "rapid_submission": 0,
    "account_age_days": 200,
    "prior_approved_claims": 10
}])[features]


# ==========================================
# SUSPICIOUS TEST CLAIM
# ==========================================

suspicious_claim = pd.DataFrame([{
    "points_claimed": 300,
    "claims_last_24h": 15,
    "user_claims_7d": 25,
    "rejected_claims_30d": 6,
    "same_activity_claims": 4,
    "duplicate_proof_count": 3,
    "proof_reuse_count": 3,
    "submission_delay_minutes": 1,
    "location_mismatch": 1,
    "rapid_submission": 1,
    "account_age_days": 5,
    "prior_approved_claims": 0
}])[features]


# ==========================================
# FUNCTION TO TEST CLAIM
# ==========================================

def test_claim(name, claim):

    prediction = model.predict(claim)[0]

    probabilities = model.predict_proba(claim)[0]

    suspicious_probability = probabilities[1]

    print("\n==============================")
    print(name)
    print("==============================")

    if prediction == 1:
        print("Prediction: SUSPICIOUS")
    else:
        print("Prediction: NORMAL")

    print(
        f"Suspicious Risk Score: "
        f"{suspicious_probability * 100:.2f}%"
    )


# ==========================================
# RUN TESTS
# ==========================================

test_claim(
    "NORMAL CITIPOINTS CLAIM",
    normal_claim
)

test_claim(
    "SUSPICIOUS CITIPOINTS CLAIM",
    suspicious_claim
)