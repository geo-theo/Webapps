from fastapi import APIRouter

from app.models.schemas import EstimateRequest, EstimateResponse
from app.services.estimator import estimate_trip

router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/estimate", response_model=EstimateResponse)
def estimate(request: EstimateRequest) -> EstimateResponse:
    return estimate_trip(request)

