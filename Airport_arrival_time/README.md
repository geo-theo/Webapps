# Airport Arrival Time

Simple geoapp MVP to estimate when a traveler should leave for the airport.

## Stack

- Frontend: React + Vite
- Backend: FastAPI
- Shared config: airport JSON profiles

## Current scope

- One airport: Denver International Airport (`DEN`)
- Inputs:
  - flight departure time
  - airline
  - origin via current browser location or manual address
  - travel mode
  - parking / curbside arrival option
  - checked bag and international toggles
- Outputs:
  - estimated time to gate if leaving now
  - tiered suggested departure times
  - countdown to gate close

## Project layout

```text
backend/
frontend/
shared-data/
```

## Frontend setup

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

The frontend expects the API at `http://localhost:8000`.

## Backend setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

If PowerShell blocks scripts, use `Activate.bat` from `cmd` or temporarily adjust your execution policy for your shell session.

## Notes

- The current manual address flow uses a small built-in geocoder for common Denver-area origins plus a fallback approximation.
- Route times are heuristic and intended for MVP validation, not production.
- The architecture is set up so routing, geocoding, and flight-status providers can be swapped in later.

