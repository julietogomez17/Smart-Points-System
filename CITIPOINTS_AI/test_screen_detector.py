from pathlib import Path
import cv2
import numpy as np
import joblib

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "MODEL" / "screen_detector_candidate.pkl"
TEST_FOLDER = BASE_DIR / "SCREEN_TEST_PHOTOS"

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
        np.abs(np.diff(gray.astype(np.float32), axis=1)).mean()
    )

    hist_features = []

    for channel in range(3):
        hist = cv2.calcHist(
            [image], [channel], None, [8], [0, 256]
        )
        hist = hist.flatten()
        hist = hist / (hist.sum() + 1e-8)
        hist_features.extend(hist.tolist())

    return [
        brightness,
        contrast,
        sharpness,
        edge_density,
        saturation,
        texture,
        *hist_features
    ]

def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    if not TEST_FOLDER.exists():
        raise FileNotFoundError(
            f"Test folder not found: {TEST_FOLDER}"
        )

    model = joblib.load(MODEL_PATH)

    print("\nCITIPOINTS SCREEN PHOTO DETECTOR")
    print("=" * 55)

    photos = sorted(
        p for p in TEST_FOLDER.iterdir()
        if p.suffix.lower() in EXTENSIONS
    )

    print(f"Photos found: {len(photos)}")

    for photo in photos:
        try:
            features = extract_features(photo)
            features = np.array([features], dtype=np.float32)

            prediction = model.predict(features)[0]

            probabilities = model.predict_proba(features)[0]
            screen_index = list(model.classes_).index(1)
            screen_score = probabilities[screen_index] * 100

            print(f"\nPhoto: {photo.name}")
            print(
                "Prediction:",
                "SCREEN PHOTO" if prediction == 1 else "NATURAL PHOTO"
            )
            print(f"Screen Score: {screen_score:.2f}%")

        except Exception as error:
            print(f"ERROR {photo.name}: {error}")

if __name__ == "__main__":
    main()