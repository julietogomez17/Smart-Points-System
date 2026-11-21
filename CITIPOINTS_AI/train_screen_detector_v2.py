
from pathlib import Path
from hashlib import sha256

import joblib
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

from vision_features import extract_features


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "SCREEN_DATASET"
MODEL_DIR = BASE_DIR / "MODEL"
MODEL_PATH = MODEL_DIR / "screen_detector_v2.pkl"
TEST_DIR = BASE_DIR / "SCREEN_TEST_PHOTOS"

EXTENSIONS = {".jpg", ".jpeg", ".png"}


def get_image_files(folder):
    return sorted(
        p for p in folder.rglob("*")
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )


def file_hash(path):
    return sha256(path.read_bytes()).hexdigest()


def main():
    print("\nCITIPOINTS SCREEN DETECTOR V2")
    print("ResNet-18 + Random Forest")
    print("=" * 55)

    X = []
    y = []
    seen = set()

    # Prevent exact overlap with the testing folder.
    test_hashes = set()

    if TEST_DIR.exists():
        for photo in get_image_files(TEST_DIR):
            test_hashes.add(file_hash(photo))

    for category, label in [
        ("natural", 0),
        ("screen", 1)
    ]:
        folder = DATA_DIR / category

        if not folder.exists():
            raise FileNotFoundError(folder)

        photos = get_image_files(folder)
        accepted = 0

        print(f"\nProcessing {category} photos...")

        for photo in photos:
            try:
                digest = file_hash(photo)

                if digest in test_hashes:
                    print("TEST OVERLAP SKIPPED:", photo.name)
                    continue

                if digest in seen:
                    print("DUPLICATE SKIPPED:", photo.name)
                    continue

                features = extract_features(photo)

                X.append(features)
                y.append(label)
                seen.add(digest)
                accepted += 1

                print("Processed:", photo.name)

            except Exception as error:
                print("ERROR:", photo.name, error)

        print(f"{category}: {accepted} usable images")

    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y, dtype=np.int32)

    counts = np.bincount(y, minlength=2)

    print("\nDATASET SUMMARY")
    print("Natural:", counts[0])
    print("Screen:", counts[1])

    if min(counts) < 5:
        raise ValueError(
            "Need at least 5 valid photos in each class."
        )

    if min(counts) < 30:
        print(
            "WARNING: Small dataset. "
            "Evaluation will be preliminary."
        )

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        stratify=y,
        random_state=42
    )

    print("\nTraining samples:", len(X_train))
    print("Testing samples:", len(X_test))

    model = RandomForestClassifier(
        n_estimators=500,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    print("\nTraining Random Forest...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    print("\nMODEL EVALUATION")
    print("=" * 55)

    print(
        "Accuracy:",
        f"{accuracy_score(y_test, predictions) * 100:.2f}%"
    )

    print("\nClassification report:")

    print(
        classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=["Natural", "Screen"],
            zero_division=0
        )
    )

    print("Confusion matrix:")
    print(
        confusion_matrix(
            y_test,
            predictions,
            labels=[0, 1]
        )
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    bundle = {
        "model": model,
        "feature_extractor": "resnet18",
        "weights": "IMAGENET1K_V1",
        "classes": {
            0: "Natural",
            1: "Screen"
        }
    }

    joblib.dump(bundle, MODEL_PATH)

    print("\nMODEL SAVED:", MODEL_PATH)


if __name__ == "__main__":
    main()
