
from pathlib import Path
from collections import Counter
import csv
import hashlib

import cv2
import joblib
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "SCREEN_DATASET"
MODEL_DIR = BASE_DIR / "MODEL"

# Do not overwrite the existing working model.
NEW_MODEL_PATH = MODEL_DIR / "screen_detector_candidate.pkl"
REPORT_PATH = BASE_DIR / "screen_training_mistakes.csv"

EXTENSIONS = {".jpg", ".jpeg", ".png"}


def extract_features(path):
    image = cv2.imread(str(path))

    if image is None:
        raise ValueError(f"Cannot read image: {path}")

    image = cv2.resize(image, (256, 256))
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    brightness = float(gray.mean())
    contrast = float(gray.std())

    sharpness = float(
        cv2.Laplacian(gray, cv2.CV_64F).var()
    )

    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.mean(edges > 0))

    saturation = float(hsv[:, :, 1].mean())

    texture = float(
        np.abs(
            np.diff(gray.astype(np.float32), axis=1)
        ).mean()
    )

    hist_features = []

    for channel in range(3):
        hist = cv2.calcHist(
            [image], [channel], None, [8], [0, 256]
        )
        hist = hist.flatten()
        hist = hist / (hist.sum() + 1e-8)
        hist_features.extend(hist.tolist())

    return np.array(
        [
            brightness,
            contrast,
            sharpness,
            edge_density,
            saturation,
            texture,
            *hist_features
        ],
        dtype=np.float32
    )


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_dataset():
    features = []
    labels = []
    paths = []
    groups = []

    seen_hashes = {}

    for folder_name, label in [
        ("natural", 0),
        ("screen", 1)
    ]:
        folder = DATA_DIR / folder_name

        if not folder.exists():
            raise FileNotFoundError(
                f"Missing dataset folder: {folder}"
            )

        files = sorted(
            p for p in folder.iterdir()
            if p.suffix.lower() in EXTENSIONS
        )

        print(f"\nLoading {folder_name}: {len(files)} files")

        for path in files:
            try:
                digest = file_hash(path)

                if digest in seen_hashes:
                    old_label, old_path = seen_hashes[digest]

                    if old_label != label:
                        raise ValueError(
                            "Same file is labeled as both "
                            f"NATURAL and SCREEN: "
                            f"{old_path} and {path}"
                        )

                    print(f"Skipped exact duplicate: {path.name}")
                    continue

                vector = extract_features(path)

                features.append(vector)
                labels.append(label)
                paths.append(str(path))
                groups.append(digest)

                seen_hashes[digest] = (label, path)

            except ValueError as error:
                # Conflicting labels should stop training.
                if "labeled as both" in str(error):
                    raise
                print(f"Skipped {path.name}: {error}")

            except Exception as error:
                print(f"Skipped {path.name}: {error}")

    return (
        np.asarray(features, dtype=np.float32),
        np.asarray(labels, dtype=np.int32),
        np.asarray(paths),
        np.asarray(groups)
    )


def main():
    print("\nCITIPOINTS DEVICE DETECTOR TRAINING")
    print("=" * 55)

    X, y, paths, groups = load_dataset()

    counts = Counter(y)

    natural_count = counts.get(0, 0)
    screen_count = counts.get(1, 0)

    print("\nDATASET SUMMARY")
    print(f"Natural photos: {natural_count}")
    print(f"Screen photos:  {screen_count}")
    print(f"Total usable:   {len(y)}")

    if natural_count < 10 or screen_count < 10:
        raise ValueError(
            "At least 10 unique usable images per class "
            "are required for this training attempt."
        )

    if natural_count < 100 or screen_count < 100:
        print(
            "\nWARNING: Dataset is small. "
            "Predictions may not generalize well."
        )

    # Try several grouped splits until both classes
    # are represented in training and testing.
    splitter = GroupShuffleSplit(
        n_splits=30,
        test_size=0.20,
        random_state=42
    )

    chosen_split = None

    for train_idx, test_idx in splitter.split(
        X, y, groups=groups
    ):
        if (
            len(set(y[train_idx])) == 2
            and len(set(y[test_idx])) == 2
        ):
            chosen_split = (train_idx, test_idx)
            break

    if chosen_split is None:
        raise ValueError(
            "Unable to create a split containing "
            "both classes. Add more images."
        )

    train_idx, test_idx = chosen_split

    X_train = X[train_idx]
    X_test = X[test_idx]

    y_train = y[train_idx]
    y_test = y[test_idx]

    print("\nTRAIN / TEST SPLIT")
    print(f"Training images: {len(X_train)}")
    print(f"Testing images:  {len(X_test)}")

    model = RandomForestClassifier(
        n_estimators=500,
        max_depth=15,
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

    accuracy = accuracy_score(y_test, predictions)

    print("\nMODEL EVALUATION")
    print("=" * 55)
    print(f"Accuracy: {accuracy * 100:.2f}%")

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=["Natural", "Screen"],
            zero_division=0
        )
    )

    print("\nConfusion Matrix:")
    print(
        confusion_matrix(
            y_test,
            predictions,
            labels=[0, 1]
        )
    )

    mistakes = []

    for idx, actual, predicted in zip(
        test_idx, y_test, predictions
    ):
        if actual != predicted:
            mistakes.append({
                "file": paths[idx],
                "actual": (
                    "SCREEN" if actual == 1 else "NATURAL"
                ),
                "predicted": (
                    "SCREEN" if predicted == 1 else "NATURAL"
                )
            })

    with REPORT_PATH.open(
        "w", newline="", encoding="utf-8"
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["file", "actual", "predicted"]
        )
        writer.writeheader()
        writer.writerows(mistakes)

    print(f"\nIncorrect predictions: {len(mistakes)}")
    print(f"Mistake report: {REPORT_PATH}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, NEW_MODEL_PATH)

    print("\nCANDIDATE MODEL SAVED")
    print(NEW_MODEL_PATH)
    print(
        "\nYour original screen_detector.pkl "
        "has NOT been overwritten."
    )


if __name__ == "__main__":
    main()
