from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


TravelMode = Literal["drive", "rideshare", "transit"]
ParkingOption = Literal["curbside", "garage", "economy", "transit_station"]


class Coordinates(BaseModel):
    lat: float
    lng: float


class EstimateRequest(BaseModel):
    airport_code: str = Field(default="DEN")
    departure_time_local: str
    airline: str = Field(default="United")
    gate_zone: Literal["A", "B", "C", "unknown"] = Field(default="unknown")
    origin_address: str | None = None
    origin_coordinates: Coordinates | None = None
    travel_mode: TravelMode = Field(default="drive")
    parking_option: ParkingOption = Field(default="garage")
    checked_bag: bool = Field(default=False)
    is_international: bool = Field(default=False)

    @model_validator(mode="after")
    def validate_origin(self) -> "EstimateRequest":
        if not self.origin_address and not self.origin_coordinates:
            raise ValueError("Either origin_address or origin_coordinates is required.")
        return self


class RiskTierResult(BaseModel):
    tier: str
    departure_time_local: str
    minutes_until_leave: int
    buffer_minutes: int


class TimeSegment(BaseModel):
    label: str
    minutes: int


class EstimateResponse(BaseModel):
    airport_code: str
    airport_name: str
    origin_label: str
    origin_coordinates: Coordinates
    airport_coordinates: Coordinates
    travel_mode: TravelMode
    total_minutes_to_gate_now: int
    arrival_at_gate_local: str
    gate_close_time_local: str
    minutes_until_gate_close: int
    missed_gate_close_if_leave_now: bool
    suggested_departures: list[RiskTierResult]
    segments: list[TimeSegment]
    assumptions: list[str]

