
from pathlib import Path
from PIL import Image, ImageStat, ImageFilter
import csv
import numpy as np

PHOTO_FOLDER = Path(__file__).resolve().parent / "GPS_TEST_PHOTOS"
OUTPUT_FILE = Path(__file__).resolve().parent / "DATASETS" / "photo_analysis_results.csv"

def analyze_image(photo_path):
    with Image.open(photo_path) as image:
        image = image.convert("RGB")
        image.thumbnail((1024, 1024))

        gray = image.convert("L")
        pixels = np.asarray(gray, dtype=np.float32)

        brightness = float(pixels.mean())
        contrast = float(pixels.std())

        # Laplacian variance for approximate sharpness
        from PIL import ImageFilter

        edges = np.asarray(
            gray.filter(ImageFilter.FIND_EDGES),
            dtype=np.float32
        )
        sharpness = float(edges.var())

        # Preliminary heuristics, not AI predictions
        is_dark = brightness < 35
        is_low_contrast = contrast < 15
        is_blurry = sharpness < 100

        return {
            "filename": photo_path.name,
            "brightness_score": round(brightness, 2),
            "contrast_score": round(contrast, 2),
            "sharpness_score": round(sharpness, 2),
            "possible_black_or_blank": int(
                is_dark and is_low_contrast
            ),
            "possible_blurry": int(is_blurry)
        }

def main():
    if not PHOTO_FOLDER.exists():
        print("Folder not found:", PHOTO_FOLDER)
        return

    photos = [
        p for p in PHOTO_FOLDER.iterdir()
        if p.suffix.lower() in (".jpg", ".jpeg", ".png")
    ]

    if not photos:
        print("No supported photos found.")
        return

    results = []

    for photo in sorted(photos):
        try:
            result = analyze_image(photo)
            results.append(result)

            print(
                f"{photo.name}: "
                f"brightness={result['brightness_score']}, "
                f"sharpness={result['sharpness_score']}, "
                f"black={result['possible_black_or_blank']}, "
                f"blurry={result['possible_blurry']}"
            )
        except Exception as error:
            print(f"ERROR {photo.name}: {error}")

    if results:
        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

        with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(
                file,
                fieldnames=results[0].keys()
            )
            writer.writeheader()
            writer.writerows(results)

        print("\nAnalysis completed!")
        print("Photos analyzed:", len(results))
        print("Results saved to:", OUTPUT_FILE)

if __name__ == "__main__":
    main()
