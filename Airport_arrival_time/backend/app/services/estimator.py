from __future__ import annotations

import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.models.schemas import Coordinates, EstimateRequest, EstimateResponse, RiskTierResult, TimeSegment
from app.services.airport_profiles import load_airport_profile
from app.services.geocode import geocode_origin


def _distance_miles(origin: Coordinates, destination: Coordinates) -> float:
    radius_miles = 3958.8
    lat1 = math.radians(origin.lat)
    lng1 = math.radians(origin.lng)
    lat2 = math.radians(destination.lat)
    lng2 = math.radians(destination.lng)
    dlat = lat2 - lat1
    dlng = lng2 - lng1

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_miles * c


def _surface_travel_minutes(distance_miles: float, travel_mode: str, departure_dt: datetime) -> int:
    hour = departure_dt.hour
    rush_multiplier = 1.18 if 6 <= hour <= 9 or 15 <= hour <= 18 else 1.0

    if travel_mode == "transit":
        base = (distance_miles / 23.0) * 60 + 10
    elif travel_mode == "rideshare":
        base = (distance_miles / 32.0) * 60 + 8
    else:
        base = (distance_miles / 35.0) * 60 + 5

    return max(8, math.ceil(base * rush_multiplier))


def estimate_trip(request: EstimateRequest) -> EstimateResponse:
    profile = load_airport_profile(request.airport_code)
    tz = ZoneInfo(profile["timezone"])

    departure_dt = datetime.fromisoformat(request.departure_time_local)
    if departure_dt.tzinfo is None:
        departure_dt = departure_dt.replace(tzinfo=tz)
    else:
        departure_dt = departure_dt.astimezone(tz)

    now = datetime.now(tz)
    gate_close_dt = departure_dt - timedelta(minutes=profile["gate_close_minutes_before_departure"])

    origin_label, origin_coords = geocode_origin(request.origin_address, request.origin_coordinates)
    airport_coords = Coordinates(**profile["coordinates"])
    distance_miles = _distance_miles(origin_coords, airport_coords)

    surface_minutes = _surface_travel_minutes(distance_miles, request.travel_mode, departure_dt)
    arrival_buffer_minutes = profile["parking_options"][request.parking_option]["minutes_to_security"]
    security_minutes = profile["security_minutes"]["international" if request.is_international else "domestic"]
    check_in_minutes = profile["check_in_minutes"]["checked_bag" if request.checked_bag else "no_bag"]
    terminal_to_gate_minutes = profile["terminal_to_gate_minutes"][request.gate_zone]

    segments = [
        TimeSegment(label="Travel to airport", minutes=surface_minutes),
        TimeSegment(label="Arrival / parking to security", minutes=arrival_buffer_minutes),
        TimeSegment(label="Bag drop / check-in", minutes=check_in_minutes),
        TimeSegment(label="Security", minutes=security_minutes),
        TimeSegment(label="Train / walk to gate", minutes=terminal_to_gate_minutes),
    ]

    total_minutes = sum(segment.minutes for segment in segments)
    arrival_at_gate = now + timedelta(minutes=total_minutes)
    minutes_until_gate_close = math.floor((gate_close_dt - now).total_seconds() / 60)

    suggested_departures: list[RiskTierResult] = []
    for tier, extra_buffer in profile["risk_tiers"].items():
        latest_leave = gate_close_dt - timedelta(minutes=total_minutes + extra_buffer)
        minutes_until_leave = math.floor((latest_leave - now).total_seconds() / 60)
        suggested_departures.append(
            RiskTierResult(
                tier=tier,
                departure_time_local=latest_leave.isoformat(timespec="minutes"),
                minutes_until_leave=minutes_until_leave,
                buffer_minutes=extra_buffer,
            )
        )

    assumptions = [
        "Manual addresses use a small MVP geocoder and may fall back to Downtown Denver.",
        f"Gate close is assumed to be {profile['gate_close_minutes_before_departure']} minutes before departure.",
        "Surface travel time uses distance-based heuristics with a rush-hour multiplier.",
        "Security, curbside, parking, and concourse transfer times come from the DEN airport profile."
    ]

    return EstimateResponse(
        airport_code=profile["code"],
        airport_name=profile["name"],
        origin_label=origin_label,
        origin_coordinates=origin_coords,
        airport_coordinates=airport_coords,
        travel_mode=request.travel_mode,
        total_minutes_to_gate_now=total_minutes,
        arrival_at_gate_local=arrival_at_gate.isoformat(timespec="minutes"),
        gate_close_time_local=gate_close_dt.isoformat(timespec="minutes"),
        minutes_until_gate_close=minutes_until_gate_close,
        missed_gate_close_if_leave_now=arrival_at_gate > gate_close_dt,
        suggested_departures=suggested_departures,
        segments=segments,
        assumptions=assumptions,
    )
