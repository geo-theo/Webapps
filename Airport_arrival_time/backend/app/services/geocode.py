from __future__ import annotations

from app.models.schemas import Coordinates


KNOWN_ORIGINS: dict[str, tuple[str, Coordinates]] = {
    "downtown denver": ("Downtown Denver", Coordinates(lat=39.7392, lng=-104.9903)),
    "union station": ("Union Station", Coordinates(lat=39.7527, lng=-105.0001)),
    "boulder": ("Boulder", Coordinates(lat=40.0150, lng=-105.2705)),
    "golden": ("Golden", Coordinates(lat=39.7555, lng=-105.2211)),
    "aurora": ("Aurora", Coordinates(lat=39.7294, lng=-104.8319)),
    "lakewood": ("Lakewood", Coordinates(lat=39.7047, lng=-105.0814)),
    "denver tech center": ("Denver Tech Center", Coordinates(lat=39.6128, lng=-104.8796))
}


def geocode_origin(address: str | None, coordinates: Coordinates | None) -> tuple[str, Coordinates]:
    if coordinates:
        return ("Current location", coordinates)

    normalized = (address or "").strip().lower()
    if normalized in KNOWN_ORIGINS:
        return KNOWN_ORIGINS[normalized]

    return ("Approximate Denver origin", Coordinates(lat=39.7392, lng=-104.9903))

