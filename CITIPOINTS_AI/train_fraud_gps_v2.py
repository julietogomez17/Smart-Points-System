
from pathlib import Path
import csv

import joblib
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)


BASE_DIR = Path(__file__).resolve().parent

DATASET_PATH = (
    BASE_DIR / "DATASETS"
    / "CITIPOINTS_Synthetic_Fraud_Dataset.csv"
)

MODEL_PATH = (
    BASE_DIR / "MODEL"
    / "citipoints_fraud_model_v2.pkl"
)

EVENT_RADIUS = 100.0

# Keep all 12 original fraud features.
ORIGINAL_FEATURES = [
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

# Add four GPS features.
GPS_FEATURES = [
    "gps_available",
    "gps_distance_meters",
    "gps_distance_ratio",
    "gps_accuracy_meters"
]

ALL_FEATURES = ORIGINAL_FEATURES + GPS_FEATURES


def load_dataset():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    rows = []
    labels = []
    user_ids = []

    with open(
        DATASET_PATH,
        newline="",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        required = (
            ORIGINAL_FEATURES
            + ["fraud_label", "user_id"]
        )

        missing = [
            column for column in required
            if column not in reader.fieldnames
        ]

        if missing:
            raise ValueError(
                f"Missing columns: {missing}"
            )

        for record in reader:
            rows.append([
                float(record[feature])
                for feature in ORIGINAL_FEATURES
            ])

            labels.append(
                int(record["fraud_label"])
            )

            user_ids.append(record["user_id"])

    X = np.asarray(rows, dtype=np.float64)
    y = np.asarray(labels, dtype=np.int32)

    return X, y, np.asarray(user_ids)


def create_gps_scenarios(X_original, y_original):
    """
    Experimental GPS review scenarios.

    The target is REVIEW REQUIRED, not
    independently verified fraud.

    Training distances are simulated.
    """

    distances = [30.0, 150.0, 5000.0, None]

    X_all = []
    y_all = []

    mismatch_index = ORIGINAL_FEATURES.index(
        "location_mismatch"
    )

    for distance in distances:

        X = X_original.copy()

        # For missing GPS, retain the original
        # historical location mismatch indicator.
        if distance is None:
            gps_available = 0
            gps_distance = -1.0
            gps_ratio = -1.0
            gps_accuracy = -1.0
            gps_review = False

        else:
            gps_available = 1
            gps_distance = distance
            gps_ratio = distance / EVENT_RADIUS
            gps_accuracy = 10.0

            gps_review = (
                distance > EVENT_RADIUS
            )

            X[:, mismatch_index] = int(gps_review)

        new_features = np.column_stack([
            np.full(len(X), gps_available),
            np.full(len(X), gps_distance),
            np.full(len(X), gps_ratio),
            np.full(len(X), gps_accuracy)
        ])

        X_extended = np.hstack([
            X, new_features
        ])

        # Simulated policy: review when original
        # label is suspicious OR GPS is outside.
        review_labels = (
            (y_original == 1) | gps_review
        ).astype(np.int32)

        X_all.append(X_extended)
        y_all.append(review_labels)

    return (
        np.vstack(X_all),
        np.concatenate(y_all)
    )


def main():
    print("\nCITIPOINTS FRAUD GPS V2")
    print("=" * 55)

    X, y, users = load_dataset()

    print("Original records:", len(X))
    print("Original features:", len(ORIGINAL_FEATURES))
    print("GPS features:", len(GPS_FEATURES))

    # Keep each user's records in only one split.
    unique_users = np.unique(users)

    train_users, test_users = train_test_split(
        unique_users,
        test_size=0.20,
        random_state=42
    )

    train_mask = np.isin(users, train_users)
    test_mask = np.isin(users, test_users)

    X_train, y_train = create_gps_scenarios(
        X[train_mask],
        y[train_mask]
    )

    X_test, y_test = create_gps_scenarios(
        X[test_mask],
        y[test_mask]
    )

    print("\nTRAIN / TEST SPLIT")
    print("Training scenarios:", len(X_train))
    print("Testing scenarios:", len(X_test))
    print("Total features:", X_train.shape[1])

    model = RandomForestClassifier(
        n_estimators=250,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    print("\nTraining Random Forest...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    print("\nEXPERIMENTAL MODEL RESULTS")
    print("=" * 55)

    print(
        f"Accuracy:  "
        f"{accuracy_score(y_test, predictions)*100:.2f}%"
    )

    print(
        f"Precision: "
        f"{precision_score(y_test, predictions, zero_division=0)*100:.2f}%"
    )

    print(
        f"Recall:    "
        f"{recall_score(y_test, predictions, zero_division=0)*100:.2f}%"
    )

    print(
        f"F1-score:  "
        f"{f1_score(y_test, predictions, zero_division=0)*100:.2f}%"
    )

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=[
                "No Review Flag",
                "Review Required"
            ],
            zero_division=0
        )
    )

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, predictions))

    print("\nFEATURE IMPORTANCE")

    importance = sorted(
        zip(ALL_FEATURES, model.feature_importances_),
        key=lambda item: item[1],
        reverse=True
    )

    for feature, score in importance:
        print(f"{feature:30s} {score:.4f}")

    MODEL_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    bundle = {
        "model": model,
        "features": ALL_FEATURES,
        "target": "review_required",
        "radius_reference": EVENT_RADIUS,
        "training_type": "synthetic_gps_scenarios"
    }

    joblib.dump(bundle, MODEL_PATH)

    print("\nMODEL SAVED SUCCESSFULLY")
    print(MODEL_PATH)
    print(
        "\nWARNING: This model was trained on "
        "simulated GPS review scenarios, "
        "not verified real-world GPS fraud."
    )


if __name__ == "__main__":
    main()
