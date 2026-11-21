
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2

from flask import Flask, request, jsonify
import joblib
import numpy as np

from reward_recommender import recommend_rewards


app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "MODEL"

# ==========================================
# LOAD AI MODELS
# ==========================================

legacy_model = joblib.load(
    MODEL_DIR / "citipoints_fraud_model.pkl"
)

bundle = joblib.load(
    MODEL_DIR / "citipoints_fraud_model_dynamic_radius.pkl"
)

gps_model = bundle["model"]
gps_features = list(bundle["features"])

original_features = [
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
# HELPERS
# ==========================================

def get_number(data, key, required=True, default=None):
    value = data.get(key)

    if value is None or value == "":
        if required:
            raise ValueError(f"Missing required field: {key}")
        return default

    if isinstance(value, bool):
        raise ValueError(f"Invalid number: {key}")

    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid number: {key}")

    if not np.isfinite(value):
        raise ValueError(f"Invalid number: {key}")

    return value


def build_input(data, feature_names):
    missing = [
        name for name in feature_names
        if name not in data
    ]

    if missing:
        raise ValueError(
            "Missing features: " + ", ".join(missing)
        )

    return np.array(
        [[get_number(data, name) for name in feature_names]],
        dtype=float
    )


def positive_probability(model, X):
    classes = list(model.classes_)

    if 1 not in classes:
        raise ValueError("Positive class 1 not found")

    index = classes.index(1)

    return float(
        model.predict_proba(X)[0][index]
    )


def get_risk_level(score):
    if score < 40:
        return "LOW"
    if score < 70:
        return "MEDIUM"
    return "HIGH"


def haversine_distance(lat1, lng1, lat2, lng2):
    radius = 6371000.0

    lat1 = radians(lat1)
    lng1 = radians(lng1)
    lat2 = radians(lat2)
    lng2 = radians(lng2)

    d_lat = lat2 - lat1
    d_lng = lng2 - lng1

    a = (
        sin(d_lat / 2) ** 2
        + cos(lat1) * cos(lat2)
        * sin(d_lng / 2) ** 2
    )

    a = min(1.0, max(0.0, a))

    return radius * (
        2 * atan2(sqrt(a), sqrt(1 - a))
    )


def valid_lat_lng(lat, lng):
    return (
        -90 <= lat <= 90
        and -180 <= lng <= 180
    )


def add_warning(warnings, reasons, code, description):
    if code not in warnings:
        warnings.append(code)

    if description not in reasons:
        reasons.append(description)


# ==========================================
# HEALTH CHECK
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "CITIPOINTS AI API is running",
        "services": {
            "fraud_detection": "available",
            "gps_fraud_detection": "available",
            "reward_recommendation": "available"
        }
    })


# ==========================================
# LEGACY FRAUD MODEL
# Keeps older integrations working
# ==========================================

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "error": "Valid JSON object required"
            }), 400

        X = build_input(data, original_features)

        prediction = int(
            legacy_model.predict(X)[0]
        )

        score = positive_probability(
            legacy_model, X
        ) * 100

        return jsonify({
            "prediction": (
                "SUSPICIOUS" if prediction == 1
                else "NORMAL"
            ),
            "risk_score": round(score, 2),
            "risk_level": get_risk_level(score),
            "requires_human_review": prediction == 1
        }), 200

    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400

    except Exception:
        app.logger.exception("Legacy AI failed")
        return jsonify({
            "error": "Fraud prediction failed"
        }), 500


# ==========================================
# GPS-AWARE FRAUD MODEL V2
# ==========================================

@app.route("/predict-v2", methods=["POST"])
def predict_v2():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "error": "Valid JSON object required"
            }), 400

        event_lat = get_number(data, "event_lat")
        event_lng = get_number(data, "event_lng")
        radius = get_number(
            data, "event_radius_meters"
        )

        if not valid_lat_lng(event_lat, event_lng):
            raise ValueError("Invalid activity coordinates")

        if radius < 50 or radius > 3000:
            raise ValueError(
                "Event radius must be 50-3000 meters"
            )

        photo_lat = get_number(
            data, "photo_lat",
            required=False
        )
        photo_lng = get_number(
            data, "photo_lng",
            required=False
        )

        if (photo_lat is None) != (photo_lng is None):
            raise ValueError(
                "Both photo coordinates must be supplied"
            )

        if (
            photo_lat is not None
            and not valid_lat_lng(photo_lat, photo_lng)
        ):
            raise ValueError("Invalid citizen coordinates")

        accuracy = get_number(
            data,
            "gps_accuracy_meters",
            required=False
        )

        if accuracy is not None and accuracy < 0:
            raise ValueError(
                "GPS accuracy cannot be negative"
            )

        warnings = []
        reasons = []

        gps_available = int(
            photo_lat is not None
            and photo_lng is not None
        )

        distance = -1.0
        ratio = -1.0
        location_mismatch = 0
        gps_status = "LOCATION_UNVERIFIED"

        # ======================================
        # INDEPENDENT GPS VERIFICATION
        # ======================================

        if gps_available:
            distance = haversine_distance(
                event_lat,
                event_lng,
                photo_lat,
                photo_lng
            )

            ratio = distance / radius

            location_mismatch = int(
                distance > radius
            )

            if accuracy is None:
                # GPS distance is reported, but
                # reliability is unknown.
                gps_status = (
                    "OUTSIDE_EVENT_AREA"
                    if distance > radius
                    else "INSIDE_EVENT_AREA"
                )

                add_warning(
                    warnings,
                    reasons,
                    "GPS_ACCURACY_UNKNOWN",
                    "Location accuracy was not provided; "
                    "the boundary cannot be verified reliably."
                )

                if location_mismatch:
                    add_warning(
                        warnings,
                        reasons,
                        "GPS_LOCATION_MISMATCH",
                        "Reported location is outside "
                        "the administrator's event radius."
                    )

            else:
                min_distance = max(
                    0.0, distance - accuracy
                )

                max_distance = distance + accuracy

                if max_distance <= radius:
                    gps_status = "INSIDE_EVENT_AREA"

                elif min_distance > radius:
                    gps_status = "OUTSIDE_EVENT_AREA"

                    add_warning(
                        warnings,
                        reasons,
                        "GPS_LOCATION_MISMATCH",
                        "The reported location is outside "
                        "the event radius even after "
                        "accounting for GPS accuracy."
                    )

                else:
                    gps_status = "BOUNDARY_UNCERTAIN"

                    add_warning(
                        warnings,
                        reasons,
                        "GPS_BOUNDARY_UNCERTAIN",
                        "GPS accuracy overlaps the "
                        "administrator's event boundary."
                    )

                if accuracy > radius:
                    add_warning(
                        warnings,
                        reasons,
                        "LOW_GPS_PRECISION",
                        "GPS accuracy is larger than "
                        "the event coverage radius."
                    )

        else:
            accuracy = None

            add_warning(
                warnings,
                reasons,
                "GPS_UNAVAILABLE",
                "Citizen location could not be verified."
            )

        # ======================================
        # ORIGINAL FRAUD FEATURES
        # ======================================

        claim = {}

        for name in original_features:
            if name == "location_mismatch":
                claim[name] = location_mismatch
            else:
                claim[name] = get_number(data, name)

        duplicate_count = claim[
            "duplicate_proof_count"
        ]

        reuse_count = claim[
            "proof_reuse_count"
        ]

        if duplicate_count > 0:
            add_warning(
                warnings,
                reasons,
                "DUPLICATE_PROOF",
                "An identical proof file already exists "
                "in participation records."
            )

        if reuse_count > 0:
            add_warning(
                warnings,
                reasons,
                "PROOF_REUSE",
                "This proof file appears to have "
                "been used previously."
            )

        if claim["rapid_submission"] > 0:
            add_warning(
                warnings,
                reasons,
                "RAPID_SUBMISSION",
                "Another participation claim was "
                "submitted within a short interval."
            )

        if claim["claims_last_24h"] >= 5:
            add_warning(
                warnings,
                reasons,
                "REPEATED_CLAIM_PATTERN",
                "Five or more claims were recorded "
                "within the last 24 hours."
            )

        if claim["user_claims_7d"] >= 7:
            add_warning(
                warnings,
                reasons,
                "HIGH_CLAIM_FREQUENCY",
                "Seven or more claims were recorded "
                "within the last seven days."
            )

        if claim["rejected_claims_30d"] > 0:
            add_warning(
                warnings,
                reasons,
                "PREVIOUS_REJECTIONS",
                "The account has previous rejected "
                "participation submissions."
            )

        if claim["same_activity_claims"] > 1:
            add_warning(
                warnings,
                reasons,
                "REPEATED_ACTIVITY_CLAIM",
                "Multiple claims for this activity "
                "have been detected."
            )

        # ======================================
        # 17 MODEL FEATURES
        # ======================================

        claim.update({
            "gps_available": gps_available,
            "gps_distance_meters": distance,
            "event_radius_meters": radius,
            "gps_distance_ratio": ratio,
            "gps_accuracy_meters": (
                accuracy
                if accuracy is not None
                else -1.0
            )
        })

        X = build_input(claim, gps_features)

        prediction = int(
            gps_model.predict(X)[0]
        )

        score = (
            positive_probability(gps_model, X)
            * 100
        )

        # ======================================
        # FINAL HUMAN-REVIEW FLAGS
        # ======================================

        independent_warning = len(warnings) > 0

        requires_review = bool(
            prediction == 1
            or independent_warning
        )

        if prediction == 1:
            classification = "SUSPICIOUS"

        elif independent_warning:
            classification = "REVIEW_REQUIRED"

        else:
            classification = "NORMAL"

        return jsonify({
            "prediction": classification,
            "risk_score": round(score, 2),
            "risk_level": get_risk_level(score),

            "requires_human_review": requires_review,
            "independent_warning": independent_warning,

            "gps_verification": {
                "status": gps_status,
                "gps_available": bool(gps_available),

                "distance_meters": (
                    round(distance, 2)
                    if gps_available
                    else None
                ),

                "event_radius_meters": radius,

                "distance_ratio": (
                    round(ratio, 4)
                    if gps_available
                    else None
                ),

                "gps_accuracy_meters": accuracy,

                "raw_location_mismatch": bool(
                    location_mismatch
                )
            },

            "warnings": warnings,
            "reasons": reasons,
            "model_version": "dynamic_radius_v2",
            "assessment_type": "experimental_review_risk"
        }), 200

    except ValueError as error:
        return jsonify({
            "error": str(error)
        }), 400

    except Exception:
        app.logger.exception("GPS fraud model failed")

        return jsonify({
            "error": "GPS fraud prediction failed"
        }), 500


# ==========================================
# REWARD RECOMMENDATIONS
# ==========================================

@app.route(
    "/recommendations/<int:user_id>",
    methods=["GET"]
)
def get_recommendations(user_id):
    try:
        result = recommend_rewards(
            user_id=user_id,
            limit=5
        )

        return jsonify({
            "success": True,
            "data": result
        }), 200

    except Exception:
        app.logger.exception(
            "Recommendation request failed"
        )

        return jsonify({
            "success": False,
            "message": "Failed to generate recommendations"
        }), 500


# ==========================================
# START FLASK SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True
    )
