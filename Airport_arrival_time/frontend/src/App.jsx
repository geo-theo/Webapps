import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";

const airport = {
  code: "DEN",
  name: "Denver International Airport",
  coordinates: [39.8561, -104.6737],
};

const defaultForm = {
  departureTime: nextRoundedDeparture(),
  airline: "United",
  gateZone: "unknown",
  originAddress: "Downtown Denver",
  travelMode: "drive",
  parkingOption: "garage",
  checkedBag: false,
  isInternational: false,
};

function nextRoundedDeparture() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 180);
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatRelativeMinutes(minutes) {
  if (minutes > 0) {
    return `in ${minutes} min`;
  }
  if (minutes === 0) {
    return "now";
  }
  return `${Math.abs(minutes)} min ago`;
}

function formatLocalDisplay(value) {
  const date = new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCountdown(totalSeconds) {
  if (totalSeconds === null) {
    return "--:--:--";
  }
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function App() {
  const [form, setForm] = useState(defaultForm);
  const [originMode, setOriginMode] = useState("manual");
  const [locationError, setLocationError] = useState("");
  const [originCoordinates, setOriginCoordinates] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const gateCountdown = useMemo(() => {
    if (!result) {
      return null;
    }
    return Math.floor((new Date(result.gate_close_time_local).getTime() - now) / 1000);
  }, [result, now]);

  async function estimateTrip(submittedForm = form, submittedCoordinates = originCoordinates, mode = originMode) {
    setLoading(true);
    setError("");

    const payload = {
      airport_code: airport.code,
      departure_time_local: submittedForm.departureTime,
      airline: submittedForm.airline,
      gate_zone: submittedForm.gateZone,
      origin_address: mode === "manual" ? submittedForm.originAddress : null,
      origin_coordinates:
        mode === "current" && submittedCoordinates
          ? { lat: submittedCoordinates.lat, lng: submittedCoordinates.lng }
          : null,
      travel_mode: submittedForm.travelMode,
      parking_option: submittedForm.parkingOption,
      checked_bag: submittedForm.checkedBag,
      is_international: submittedForm.isInternational,
    };

    try {
      const response = await fetch("http://localhost:8000/estimate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Estimator request failed.");
      }

      const data = await response.json();
      setResult(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to estimate trip.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    estimateTrip();
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Browser geolocation is not available.");
      return;
    }

    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setOriginMode("current");
        setOriginCoordinates(coords);
        estimateTrip(form, coords, "current");
      },
      () => {
        setLocationError("Location access failed. Enter an address manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const routeLine = result
    ? [
        [result.origin_coordinates.lat, result.origin_coordinates.lng],
        [result.airport_coordinates.lat, result.airport_coordinates.lng],
      ]
    : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Airport timing planner</p>
          <h1>Leave For The Airport</h1>
          <p className="muted">
            Estimate whether you can still make your gate and when to leave based on your tolerance for risk.
          </p>
        </div>

        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="section-header">
            <h2>Trip Inputs</h2>
            <span>{airport.code}</span>
          </div>

          <label>
            Departure time
            <input
              type="datetime-local"
              name="departureTime"
              value={form.departureTime}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Airline
            <input type="text" name="airline" value={form.airline} onChange={updateField} />
          </label>

          <label>
            Gate concourse
            <select name="gateZone" value={form.gateZone} onChange={updateField}>
              <option value="unknown">Unknown</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>

          <div className="mode-row">
            <button
              type="button"
              className={originMode === "manual" ? "secondary active" : "secondary"}
              onClick={() => setOriginMode("manual")}
            >
              Enter address
            </button>
            <button type="button" className="secondary" onClick={useCurrentLocation}>
              Use current location
            </button>
          </div>

          <label>
            Origin
            <input
              type="text"
              name="originAddress"
              value={form.originAddress}
              onChange={updateField}
              disabled={originMode === "current"}
              placeholder="Downtown Denver"
            />
          </label>

          <div className="grid-two">
            <label>
              Travel mode
              <select name="travelMode" value={form.travelMode} onChange={updateField}>
                <option value="drive">Drive</option>
                <option value="rideshare">Rideshare</option>
                <option value="transit">Transit</option>
              </select>
            </label>

            <label>
              Arrival option
              <select name="parkingOption" value={form.parkingOption} onChange={updateField}>
                <option value="garage">Garage</option>
                <option value="economy">Economy + shuttle</option>
                <option value="curbside">Curbside drop-off</option>
                <option value="transit_station">Transit station</option>
              </select>
            </label>
          </div>

          <div className="check-row">
            <label className="check">
              <input type="checkbox" name="checkedBag" checked={form.checkedBag} onChange={updateField} />
              Checked bag
            </label>

            <label className="check">
              <input
                type="checkbox"
                name="isInternational"
                checked={form.isInternational}
                onChange={updateField}
              />
              International
            </label>
          </div>

          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Estimating..." : "Estimate trip"}
          </button>

          {locationError ? <p className="inline-error">{locationError}</p> : null}
          {error ? <p className="inline-error">{error}</p> : null}
        </form>

        <section className="panel">
          <div className="section-header">
            <h2>Countdown</h2>
            <span>Gate close</span>
          </div>

          {result ? (
            <>
              <div className="countdown-clock">
                <strong>{formatCountdown(gateCountdown)}</strong>
              </div>
              <p className="muted">Gate closes at {formatLocalDisplay(result.gate_close_time_local)}</p>
            </>
          ) : (
            <p className="muted">Run an estimate to start the countdown.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Suggested Departure</h2>
            <span>Risk tiers</span>
          </div>

          {result ? (
            <div className="tier-list">
              {result.suggested_departures.map((tier) => (
                <article className={`tier-card tier-${tier.tier}`} key={tier.tier}>
                  <div>
                    <h3>{tier.tier}</h3>
                    <p>{formatLocalDisplay(tier.departure_time_local)}</p>
                  </div>
                  <div className="tier-meta">
                    <strong>{formatRelativeMinutes(tier.minutes_until_leave)}</strong>
                    <span>+{tier.buffer_minutes} min buffer</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Suggested departure times appear after the first estimate.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Trip Breakdown</h2>
            <span>Minutes</span>
          </div>

          {result ? (
            <div className="segment-list">
              {result.segments.map((segment) => (
                <div className="segment-row" key={segment.label}>
                  <span>{segment.label}</span>
                  <strong>{segment.minutes} min</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Travel, security, and gate timing assumptions show here.</p>
          )}
        </section>
      </aside>

      <main className="map-stage">
        <div className="map-summary">
          {result ? (
            <>
              <div className="summary-card">
                <span className="label">If you leave now</span>
                <strong>{result.total_minutes_to_gate_now} min to gate</strong>
                <p>Estimated gate arrival: {formatLocalDisplay(result.arrival_at_gate_local)}</p>
              </div>
              <div className={`summary-card ${result.missed_gate_close_if_leave_now ? "late" : "on-time"}`}>
                <span className="label">Status</span>
                <strong>{result.missed_gate_close_if_leave_now ? "Likely miss gate close" : "Still on track"}</strong>
                <p>Origin: {result.origin_label}</p>
              </div>
            </>
          ) : (
            <div className="summary-card empty">
              <span className="label">Map</span>
              <strong>Estimate a trip to draw the route.</strong>
              <p>The app currently uses DEN airport timing assumptions and a heuristic routing model.</p>
            </div>
          )}
        </div>

        <div className="map-frame">
          <MapContainer center={airport.coordinates} zoom={10} scrollWheelZoom className="map-canvas">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker center={airport.coordinates} radius={10} pathOptions={{ color: "#14213d", fillColor: "#14213d", fillOpacity: 0.9 }}>
              <Popup>{airport.name}</Popup>
            </CircleMarker>
            {result ? (
              <CircleMarker
                center={[result.origin_coordinates.lat, result.origin_coordinates.lng]}
                radius={9}
                pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.95 }}
              >
                <Popup>{result.origin_label}</Popup>
              </CircleMarker>
            ) : null}
            {routeLine ? <Polyline positions={routeLine} pathOptions={{ color: "#f97316", weight: 5 }} /> : null}
          </MapContainer>
        </div>

        <div className="map-footer panel">
          <div className="section-header">
            <h2>Current assumptions</h2>
            <span>MVP</span>
          </div>
          {result ? (
            <ul className="assumption-list">
              {result.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">This first version is designed to validate the product shape before adding live providers.</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
