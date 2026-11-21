
from pathlib import Path
import csv
import joblib
import numpy as np


# ==========================================
# FILE PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "MODEL"
    / "citipoints_fraud_model_dynamic_radius.pkl"
)

TEST_DATA_PATH = (
    BASE_DIR
    / "DATASETS"
    / "independent_gps_test.csv"
)


# ==========================================
# LOAD MODEL
# ==========================================

print("=" * 65)
print("CITIPOINTS RANDOM FOREST ACCURACY TEST")
print("=" * 65)

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found: {MODEL_PATH}"
    )

bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
features = list(bundle["features"])

classes = list(model.classes_)

if 1 not in classes:
    raise ValueError(
        "Model does not contain positive class 1."
    )

positive_index = classes.index(1)

print("\nMODEL INFORMATION")
print("Total features:", len(features))
print("Number of trees:", model.n_estimators)
print("Classes:", classes)

print("\nMODEL FEATURES")

for index, feature in enumerate(features, start=1):
    print(f"{index:2}. {feature}")

if len(features) != 17:
    raise ValueError(
        "Expected 17 dynamic-radius model features."
    )


# ==========================================
# MANUAL ACCURACY METRICS
# NO sklearn.metrics IMPORT REQUIRED
# ==========================================

def evaluate_predictions(y_true, y_pred):

    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)

    if len(y_true) != len(y_pred):
        raise ValueError(
            "True and predicted labels have different lengths."
        )

    if len(y_true) == 0:
        raise ValueError("Test labels are empty.")

    if not np.all(np.isin(y_true, [0, 1])):
        raise ValueError(
            "True labels must contain only 0 and 1."
        )

    if not np.all(np.isin(y_pred, [0, 1])):
        raise ValueError(
            "Predictions must contain only 0 and 1."
        )

    tp = int(
        np.sum((y_true == 1) & (y_pred == 1))
    )

    tn = int(
        np.sum((y_true == 0) & (y_pred == 0))
    )

    fp = int(
        np.sum((y_true == 0) & (y_pred == 1))
    )

    fn = int(
        np.sum((y_true == 1) & (y_pred == 0))
    )

    total = tp + tn + fp + fn

    accuracy = (tp + tn) / total

    precision = (
        tp / (tp + fp)
        if (tp + fp) > 0
        else 0
    )

    recall = (
        tp / (tp + fn)
        if (tp + fn) > 0
        else 0
    )

    specificity = (
        tn / (tn + fp)
        if (tn + fp) > 0
        else 0
    )

    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0
    )

    false_positive_rate = (
        fp / (fp + tn)
        if (fp + tn) > 0
        else 0
    )

    false_negative_rate = (
        fn / (fn + tp)
        if (fn + tp) > 0
        else 0
    )

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "specificity": specificity,
        "f1": f1,
        "false_positive_rate": false_positive_rate,
        "false_negative_rate": false_negative_rate,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
        "total": total
    }


# ==========================================
# BUILD TEST CLAIM
# ==========================================

def assess(
    radius,
    distance=None,
    duplicates=0,
    rejected=0,
    claims24=1,
    rapid=0,
    accuracy=10,
    proof_reuse=None,
    account_age=200
):

    if radius <= 0:
        raise ValueError(
            "Event radius must be greater than zero."
        )

    gps_available = int(distance is not None)

    if gps_available:
        gps_distance = float(distance)
        gps_ratio = gps_distance / float(radius)
        location_mismatch = int(
            gps_distance > radius
        )
        gps_accuracy = float(accuracy)

    else:
        gps_distance = -1.0
        gps_ratio = -1.0
        location_mismatch = 0
        gps_accuracy = -1.0

    if proof_reuse is None:
        proof_reuse = duplicates

    claim = {
        "points_claimed": 50,
        "claims_last_24h": claims24,
        "user_claims_7d": max(3, claims24),
        "rejected_claims_30d": rejected,
        "same_activity_claims": 1,
        "duplicate_proof_count": duplicates,
        "proof_reuse_count": proof_reuse,
        "submission_delay_minutes": 45,
        "location_mismatch": location_mismatch,
        "rapid_submission": rapid,
        "account_age_days": account_age,
        "prior_approved_claims": 10,
        "gps_available": gps_available,
        "gps_distance_meters": gps_distance,
        "event_radius_meters": radius,
        "gps_distance_ratio": gps_ratio,
        "gps_accuracy_meters": gps_accuracy
    }

    X = np.array(
        [[claim[name] for name in features]],
        dtype=float
    )

    probability = model.predict_proba(X)[0]

    score = float(
        probability[positive_index]
    ) * 100

    prediction = int(
        model.predict(X)[0]
    )

    return {
        "score": score,
        "prediction": prediction,
        "gps_available": bool(gps_available),
        "location_mismatch": bool(location_mismatch),
        "claim": claim
    }


# ==========================================
# SCENARIO TESTS
# ==========================================

scenarios = [
    {
        "name": "Normal photo inside 100m",
        "radius": 100,
        "distance": 30
    },
    {
        "name": "Photo outside 100m",
        "radius": 100,
        "distance": 150
    },
    {
        "name": "Photo very far outside",
        "radius": 100,
        "distance": 5000
    },
    {
        "name": "Photo inside 1000m",
        "radius": 1000,
        "distance": 500
    },
    {
        "name": "Same distance with smaller radius",
        "radius": 100,
        "distance": 500
    },
    {
        "name": "Same distance with larger radius",
        "radius": 1000,
        "distance": 500
    },
    {
        "name": "Near boundary - inside",
        "radius": 250,
        "distance": 240
    },
    {
        "name": "Near boundary - outside",
        "radius": 250,
        "distance": 260
    },
    {
        "name": "Three duplicate proofs",
        "radius": 250,
        "distance": 30,
        "duplicates": 3
    },
    {
        "name": "Three previous rejected claims",
        "radius": 250,
        "distance": 30,
        "rejected": 3
    },
    {
        "name": "High claim frequency",
        "radius": 250,
        "distance": 30,
        "claims24": 8
    },
    {
        "name": "Rapid submission",
        "radius": 250,
        "distance": 30,
        "rapid": 1
    },
    {
        "name": "GPS unavailable",
        "radius": 250,
        "distance": None
    },
    {
        "name": "Small event - 50m radius",
        "radius": 50,
        "distance": 40
    },
    {
        "name": "Large event - 3000m radius",
        "radius": 3000,
        "distance": 2500
    },
    {
        "name": "Real CitiPoints activity #82 - inside",
        "radius": 250,
        "distance": 100
    },
    {
        "name": "Real CitiPoints activity #82 - outside",
        "radius": 250,
        "distance": 400
    },
    {
        "name": "Proof reuse without GPS mismatch",
        "radius": 250,
        "distance": 30,
        "proof_reuse": 3
    }
]


print("\n" + "=" * 65)
print("SCENARIO TEST RESULTS")
print("=" * 65)

scenario_results = []

for scenario in scenarios:

    name = scenario["name"]

    inputs = {
        key: value
        for key, value in scenario.items()
        if key != "name"
    }

    result = assess(**inputs)

    scenario_results.append({
        "name": name,
        **result
    })

    distance = inputs.get("distance")

    print(f"\nSCENARIO: {name}")
    print(f"Event radius: {inputs['radius']} meters")
    print(f"Photo distance: {distance} meters")

    print(
        f"AI review score: {result['score']:.2f}%"
    )

    print(
        "Model prediction:",
        "REVIEW"
        if result["prediction"] == 1
        else "NORMAL"
    )

    if not result["gps_available"]:
        gps_status = "LOCATION_UNVERIFIED"

    elif result["location_mismatch"]:
        gps_status = "OUTSIDE_EVENT_AREA"

    else:
        gps_status = "INSIDE_EVENT_AREA"

    print("GPS status:", gps_status)


# ==========================================
# BEHAVIOR CONSISTENCY CHECKS
# ==========================================

print("\n" + "=" * 65)
print("MODEL BEHAVIOR CONSISTENCY")
print("=" * 65)

checks = []

normal = assess(radius=100, distance=30)
outside = assess(radius=100, distance=150)
far_outside = assess(radius=100, distance=5000)

checks.append((
    "Normal claim has lower score than outside claim",
    normal["score"] < outside["score"]
))

checks.append((
    "Normal claim has lower score than far-outside claim",
    normal["score"] < far_outside["score"]
))

same_distance_small = assess(
    radius=100,
    distance=500
)

same_distance_large = assess(
    radius=1000,
    distance=500
)

checks.append((
    "Increasing event radius lowers GPS review score",
    same_distance_small["score"] >
    same_distance_large["score"]
))

baseline_duplicate = assess(
    radius=250,
    distance=30,
    duplicates=0
)

with_duplicates = assess(
    radius=250,
    distance=30,
    duplicates=3
)

checks.append((
    "Duplicate proofs increase review score",
    with_duplicates["score"] >
    baseline_duplicate["score"]
))

checks.append((
    "Missing GPS is identified correctly",
    assess(
        radius=250,
        distance=None
    )["gps_available"] is False
))

passed = 0

for description, successful in checks:

    status = "PASS" if successful else "FAIL"

    print(f"{status}: {description}")

    if successful:
        passed += 1

print(
    f"\nConsistency checks passed: "
    f"{passed}/{len(checks)}"
)

print(
    "\nNOTE: Consistency checks are not "
    "independent accuracy measurements."
)


# ==========================================
# INDEPENDENT DATASET EVALUATION
# ==========================================

print("\n" + "=" * 65)
print("INDEPENDENT DATASET EVALUATION")
print("=" * 65)

if not TEST_DATA_PATH.exists():

    print("\nIndependent test dataset NOT FOUND.")

    print(
        "\nExpected file:"
    )

    print(TEST_DATA_PATH)

    print(
        "\nThe model behavior tests have completed,"
    )

    print(
        "but actual independent accuracy,"
    )

    print(
        "precision, recall and F1 cannot be"
    )

    print(
        "calculated without independent labeled data."
    )

else:

    X_rows = []
    y_true = []

    with TEST_DATA_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        label_column = "review_required"

        required_columns = (
            features + [label_column]
        )

        missing_columns = [
            name
            for name in required_columns
            if name not in (
                reader.fieldnames or []
            )
        ]

        if missing_columns:
            raise ValueError(
                "Missing dataset columns: "
                + ", ".join(missing_columns)
            )

        for row_number, row in enumerate(
            reader,
            start=2
        ):

            values = [
                float(row[name])
                for name in features
            ]

            label = int(
                row[label_column]
            )

            if label not in (0, 1):
                raise ValueError(
                    f"Invalid label at row {row_number}"
                )

            if not np.all(
                np.isfinite(values)
            ):
                raise ValueError(
                    f"Invalid feature at row {row_number}"
                )

            X_rows.append(values)
            y_true.append(label)

    if not X_rows:
        raise ValueError(
            "Independent test dataset is empty."
        )

    X_test = np.array(
        X_rows,
        dtype=float
    )

    y_test = np.array(
        y_true,
        dtype=int
    )

    y_pred = model.predict(X_test)

    results = evaluate_predictions(
        y_test,
        y_pred
    )

    print(
        "\nTotal test records:",
        results["total"]
    )

    print(
        f"Accuracy: "
        f"{results['accuracy'] * 100:.2f}%"
    )

    print(
        f"Precision: "
        f"{results['precision'] * 100:.2f}%"
    )

    print(
        f"Recall: "
        f"{results['recall'] * 100:.2f}%"
    )

    print(
        f"F1 Score: "
        f"{results['f1'] * 100:.2f}%"
    )

    print(
        f"Specificity: "
        f"{results['specificity'] * 100:.2f}%"
    )

    print(
        f"False Positive Rate: "
        f"{results['false_positive_rate'] * 100:.2f}%"
    )

    print(
        f"False Negative Rate: "
        f"{results['false_negative_rate'] * 100:.2f}%"
    )

    print("\nCONFUSION MATRIX")

    print(
        "                  Predicted NORMAL  "
        "Predicted REVIEW"
    )

    print(
        f"Actual NORMAL       "
        f"{results['tn']:8d}      "
        f"{results['fp']:8d}"
    )

    print(
        f"Actual REVIEW       "
        f"{results['fn']:8d}      "
        f"{results['tp']:8d}"
    )

    print("\nCLASSIFICATION COUNTS")

    print(
        "True Positives:",
        results["tp"]
    )

    print(
        "True Negatives:",
        results["tn"]
    )

    print(
        "False Positives:",
        results["fp"]
    )

    print(
        "False Negatives:",
        results["fn"]
    )

    print("\nIMPORTANT:")

    print(
        "These metrics are independent only if"
    )

    print(
        "the test records and related claims were"
    )

    print(
        "excluded from model training and tuning."
    )

    print(
        "Review-required labels are not necessarily"
    )

    print(
        "confirmed cases of real-world fraud."
    )


print("\n" + "=" * 65)
print("CITIPOINTS EVALUATION FINISHED")
print("=" * 65)
