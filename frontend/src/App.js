import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

export default function App() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // ===== Flights state =====
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flightAdults, setFlightAdults] = useState(1);
  const [flightChildren, setFlightChildren] = useState(0);
  const [flightResults, setFlightResults] = useState([]);
  const [returnResults, setReturnResults] = useState([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [flightError, setFlightError] = useState("");
  const [tripType, setTripType] = useState("one_way");

  // ===== Hotels state =====
  const [hotelSearchMode, setHotelSearchMode] = useState("city"); // "city" | "name"
  const [hotelCity, setHotelCity] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [hotelAdults, setHotelAdults] = useState(2);
  const [hotelChildren, setHotelChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState("");
  const [hotelResults, setHotelResults] = useState([]);
  const [loadingHotel, setLoadingHotel] = useState(false);
  const [hotelError, setHotelError] = useState("");

  // ===== Popular Destinations (Klook) state =====
  const [popular, setPopular] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [popularError, setPopularError] = useState("");

  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  // ===== Flights search =====
  async function handleFlightSearch(e) {
    e.preventDefault();
    setFlightError("");
    setFlightResults([]);
    setReturnResults([]);
    setLoadingFlights(true);
    try {
      if (!origin || !destination || !departureDate) {
        setFlightError("Please provide origin, destination and departure date.");
        setLoadingFlights(false);
        return;
      }
      const params = {
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departureDate,
        adults: flightAdults,
        children: flightChildren,
        tripType,
      };
      if (tripType === "round_trip") {
        if (!returnDate) {
          setFlightError("Please select a return date for round trip.");
          setLoadingFlights(false);
          return;
        }
        params.returnDate = returnDate;
      }
      const res = await axios.get("/api/flights", { params });
      setFlightResults(res.data?.outbound || []);
      setReturnResults(res.data?.return || []);
    } catch (err) {
      console.error(err);
      setFlightError("Flight search failed.");
    } finally {
      setLoadingFlights(false);
    }
  }

  // ===== Hotels search =====
  async function handleHotelSearch(e) {
    e.preventDefault();
    setHotelError("");
    setHotelResults([]);
    setLoadingHotel(true);
    try {
      const location =
        hotelSearchMode === "city" ? hotelCity.trim() : hotelName.trim();

      if (!location || !checkInDate || !checkOutDate) {
        setHotelError(
          hotelSearchMode === "city"
            ? "Please provide city and both dates."
            : "Please provide hotel name and both dates."
        );
        setLoadingHotel(false);
        return;
      }

      // Send unified payload the backend expects
      const res = await axios.get("/api/hotels", {
        params: {
          searchMode: hotelSearchMode, // "city" | "name"
          location,                    // city name or hotel name
          checkInDate,
          checkOutDate,
          adults: hotelAdults,
          children: hotelChildren,
          ages: childrenAges,
        },
      });

      setHotelResults(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setHotelError("Hotel search failed.");
    } finally {
      setLoadingHotel(false);
    }
  }

  // ===== Popular Destinations (Klook) load =====
  async function loadPopular() {
    setPopularError("");
    setPopular([]);
    setLoadingPopular(true);
    try {
      const res = await axios.get("/api/popular-destinations", {
        params: { limit: 12 },
      });
      setPopular(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setPopularError("Failed to load popular destinations.");
    } finally {
      setLoadingPopular(false);
    }
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="brand-badge">TP</div>
          <h1>Trip Planner</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn secondary"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "🌞 Light Mode" : "🌙 Dark Mode"}
          </button>
          <button className="btn secondary" onClick={loadPopular}>
            🌍 Popular Destinations
          </button>
        </div>
      </div>

      <div className="app-grid">
        {/* ===== Flights Panel ===== */}
        <div className="panel">
          <h2>Flight Search</h2>
          <form onSubmit={handleFlightSearch} className="search-form search-row-4">
            <div className="triptype-row">
              <div className="field-label" style={{ marginBottom: 0 }}>
                Trip type
              </div>
              <div className="segmented">
                <input
                  type="radio"
                  id="tt-oneway"
                  name="tripType"
                  value="one_way"
                  checked={tripType === "one_way"}
                  onChange={() => setTripType("one_way")}
                />
                <label htmlFor="tt-oneway">One-way</label>
                <input
                  type="radio"
                  id="tt-round"
                  name="tripType"
                  value="round_trip"
                  checked={tripType === "round_trip"}
                  onChange={() => setTripType("round_trip")}
                />
                <label htmlFor="tt-round">Round trip</label>
              </div>
              <div className="spacer" />
            </div>

            <div>
              <div className="field-label">Origin</div>
              <input
                placeholder="e.g. DEL"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">Destination</div>
              <input
                placeholder="e.g. BOM"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">Date of travel</div>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">Date of return</div>
              {tripType === "round_trip" ? (
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              ) : (
                <input
                  type="date"
                  disabled
                  placeholder="One-way"
                  style={{ opacity: 0.5 }}
                  readOnly
                />
              )}
            </div>
            <div>
              <div className="field-label">Adults</div>
              <input
                type="number"
                min={1}
                max={6}
                value={flightAdults}
                onChange={(e) => setFlightAdults(Number(e.target.value))}
              />
            </div>
            <div>
              <div className="field-label">Children</div>
              <input
                type="number"
                min={0}
                max={4}
                value={flightChildren}
                onChange={(e) => setFlightChildren(Number(e.target.value))}
              />
            </div>

            <div className="search-actions">
              <button className="btn" type="submit">
                Search Flights
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setTripType("one_way");
                  setOrigin("");
                  setDestination("");
                  setDepartureDate("");
                  setReturnDate("");
                  setFlightAdults(1);
                  setFlightChildren(0);
                  setFlightResults([]);
                  setReturnResults([]);
                  setFlightError("");
                }}
              >
                Reset
              </button>
            </div>
          </form>

          {loadingFlights && <div className="muted">Loading flights…</div>}
          {flightError && <div className="error">{flightError}</div>}

          {flightResults.length > 0 && (
            <div className="list grid-auto">
              {flightResults.map((f, i) => (
                <div className="card" key={`dep-${i}`}>
                  {f.airlineName && (
                    <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                      {f.airlineName}
                    </div>
                  )}
                  <div className="card-top">
                    <div className="row chips">
                      <span className="badge">{f.flight}</span>
                      <span className="pill">
                        {f.from} → {f.to}
                      </span>
                      <span className="pill">Duration: {f.duration}</span>
                    </div>
                    <div className="price">{f.currency || "INR"} {f.price}</div>
                  </div>
                  <div className="row muted">
                    <span>Depart: {fmt(f.departAt)}</span>
                    <span>Arrive: {fmt(f.arriveAt)}</span>
                    {f.bookableSeats != null && <span>Seats: {f.bookableSeats}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {returnResults.length > 0 && (
            <>
              <div className="divider" />
              <div className="muted">Return flights</div>
              <div className="list grid-auto">
                {returnResults.map((f, i) => (
                  <div className="card" key={`ret-${i}`}>
                    {f.airlineName && (
                      <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                        {f.airlineName}
                      </div>
                    )}
                    <div className="card-top">
                      <div className="row chips">
                        <span className="badge">{f.flight}</span>
                        <span className="pill">
                          {f.from} → {f.to}
                        </span>
                        <span className="pill">Duration: {f.duration}</span>
                      </div>
                      <div className="price">{f.currency || "INR"} {f.price}</div>
                    </div>
                    <div className="row muted">
                      <span>Depart: {fmt(f.departAt)}</span>
                      <span>Arrive: {fmt(f.arriveAt)}</span>
                      {f.bookableSeats != null && <span>Seats: {f.bookableSeats}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ===== Hotels Panel ===== */}
        <div className="panel">
          <h2>Hotel Search</h2>

          {/* Mode toggle */}
          <div style={{ marginBottom: 12 }}>
            <div className="field-label" style={{ marginBottom: 6 }}>Search mode</div>
            <div className="segmented">
              <input
                type="radio"
                id="hs-city"
                name="hotelSearchMode"
                value="city"
                checked={hotelSearchMode === "city"}
                onChange={() => setHotelSearchMode("city")}
              />
              <label htmlFor="hs-city">By City</label>

              <input
                type="radio"
                id="hs-name"
                name="hotelSearchMode"
                value="name"
                checked={hotelSearchMode === "name"}
                onChange={() => setHotelSearchMode("name")}
              />
              <label htmlFor="hs-name">By Name</label>
            </div>
          </div>

          <form onSubmit={handleHotelSearch} className="search-form search-row-3">
            {hotelSearchMode === "city" ? (
              <div>
                <div className="field-label">City</div>
                <input
                  placeholder="e.g. New Delhi"
                  value={hotelCity}
                  onChange={(e) => setHotelCity(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <div className="field-label">Hotel Name</div>
                <input
                  placeholder="e.g. Taj Palace"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                />
              </div>
            )}

            <div>
              <div className="field-label">Check-in date</div>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">Check-out date</div>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">Adults</div>
              <input
                type="number"
                min={1}
                max={6}
                value={hotelAdults}
                onChange={(e) => setHotelAdults(Number(e.target.value))}
              />
            </div>
            <div>
              <div className="field-label">Children</div>
              <input
                type="number"
                min={0}
                max={4}
                value={hotelChildren}
                onChange={(e) => setHotelChildren(Number(e.target.value))}
              />
            </div>
            <div>
              <div className="field-label">Children ages</div>
              <input
                placeholder="e.g. 4,6"
                value={childrenAges}
                onChange={(e) => setChildrenAges(e.target.value)}
              />
            </div>

            <div className="search-actions">
              <button className="btn" type="submit">
                Search Hotels
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setHotelCity("");
                  setHotelName("");
                  setCheckInDate("");
                  setCheckOutDate("");
                  setHotelAdults(2);
                  setHotelChildren(0);
                  setChildrenAges("");
                  setHotelResults([]);
                  setHotelError("");
                  setHotelSearchMode("city");
                }}
              >
                Reset
              </button>
            </div>
          </form>

          {loadingHotel && <div className="muted">Loading hotels…</div>}
          {hotelError && <div className="error">{hotelError}</div>}

          {hotelResults.length > 0 && (
            <div className="list grid-auto">
              {hotelResults.map((h, idx) => (
                <div className="card" key={idx}>
                  <div className="card-top">
                    <div className="row">
                      <div className="hotel-name">{h.name}</div>
                      <span className="pill">{h.duration}</span>
                    </div>
                    <div className="price">{h.price}</div>
                  </div>
                  <div className="muted">{h.person_details}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Popular Destinations Panel (Klook) ===== */}
        <div className="panel">
          <h2>Popular Destinations</h2>
          {loadingPopular && <div className="muted">Loading…</div>}
          {popularError && <div className="error">{popularError}</div>}
          {popular.length > 0 && (
            <div className="list grid-auto">
              {popular.map((p, idx) => (
                <div className="card" key={idx}>
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.name || "Destination"}
                      style={{ width: "100%", borderRadius: 4, marginBottom: 8 }}
                    />
                  )}
                  <div className="hotel-name">{p.name || "Destination"}</div>
                  {p.tagline && <div className="muted">{p.tagline}</div>}
                  {p.link && (
                    <a
                      className="btn secondary"
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginTop: 8 }}
                    >
                      View on Klook
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {(!loadingPopular && !popularError && popular.length === 0) && (
            <div className="muted">Click “Popular Destinations” in the header to load.</div>
          )}
        </div>
      </div>
    </div>
  );
}