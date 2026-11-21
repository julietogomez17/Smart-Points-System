
from math import radians, sin, cos, sqrt, atan2
from PIL import Image

# Default for testing.
# In CitiPoints, this will come from the activity database.
DEFAULT_EVENT_RADIUS = 100


def calculate_distance(event_lat, event_lng,
                       photo_lat, photo_lng):
    """Calculate distance in meters using Haversine."""

    earth_radius = 6371000

    lat1, lon1 = radians(event_lat), radians(event_lng)
    lat2, lon2 = radians(photo_lat), radians(photo_lng)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2)
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius * c


def extract_photo_gps(photo_path):
    """Extract GPS from an original JPEG's EXIF data."""

    with Image.open(photo_path) as image:
        exif = image.getexif()
        gps = exif.get_ifd(34853)

    if not gps or 2 not in gps or 4 not in gps:
        return None

    def decimal_degrees(values):
        return (
            float(values[0])
            + float(values[1]) / 60
            + float(values[2]) / 3600
        )

    latitude = decimal_degrees(gps[2])
    longitude = decimal_degrees(gps[4])

    if gps.get(1) == "S":
        latitude = -latitude

    if gps.get(3) == "W":
        longitude = -longitude

    return latitude, longitude


def verify_photo_location(
    photo_path,
    event_lat,
    event_lng,
    allowed_radius=DEFAULT_EVENT_RADIUS
):
    """Prepare location features for fraud assessment."""

    if allowed_radius <= 0:
        raise ValueError("Event radius must be positive")

    coordinates = extract_photo_gps(photo_path)

    if coordinates is None:
        return {
            "gps_available": 0,
            "gps_distance_meters": None,
            "gps_distance_ratio": None,
            "location_mismatch": None,
            "gps_status": "LOCATION_UNVERIFIED"
        }

    photo_lat, photo_lng = coordinates

    distance = calculate_distance(
        event_lat, event_lng,
        photo_lat, photo_lng
    )

    return {
        "gps_available": 1,
        "gps_distance_meters": round(distance, 2),
        "gps_distance_ratio": round(
            distance / allowed_radius, 4
        ),
        "location_mismatch": int(
            distance > allowed_radius
        ),
        "gps_status": (
            "OUTSIDE_EVENT_AREA"
            if distance > allowed_radius
            else "INSIDE_EVENT_AREA"
        )
    }


if __name__ == "__main__":
    result = verify_photo_location(
        photo_path="IMG_8724.JPG",
        event_lat=10.312442,
        event_lng=123.959141,
        allowed_radius=100
    )

    print("CITIPOINTS GPS VERIFICATION")
    print("----------------------------")

    for key, value in result.items():
        print(f"{key}: {value}")
