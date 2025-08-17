require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const AIRLINES = {
  AI: "Air India",
  "6E": "IndiGo",
  UK: "Vistara",
  IX: "Air India Express",
  SG: "SpiceJet",
  G8: "Go First",
  LH: "Lufthansa",
  EK: "Emirates",
  QR: "Qatar Airways",
  SQ: "Singapore Airlines",
  BA: "British Airways",
  CX: "Cathay Pacific", 
};

// ========= Amadeus Authentication =========
let accessToken = "";
let tokenExpiry = 0;

async function authenticateAmadeus() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const resp = await axios.post(
    "https://test.api.amadeus.com/v1/security/oauth2/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_API_KEY,
      client_secret: process.env.AMADEUS_API_SECRET,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  accessToken = resp.data.access_token;
  tokenExpiry = Date.now() + resp.data.expires_in * 1000 - 60000;
  return accessToken;
}

// ========= City autocomplete =========
app.get("/api/city-autocomplete", async (req, res) => {
  const { keyword } = req.query;
  if (!keyword || keyword.length < 2) return res.json([]);
  try {
    const token = await authenticateAmadeus();
    const r = await axios.get(
      "https://test.api.amadeus.com/v1/reference-data/locations",
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { keyword, subType: "CITY", "page[limit]": 10 },
      }
    );
    const cities = (r.data.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      iataCode: c.iataCode,
    }));
    res.json(cities);
  } catch (e) {
    console.error("City autocomplete error:", e.response?.data || e.message);
    res.status(500).json([]);
  }
});

// ========= Flight Offer mapping =========
function mapOffer(offer) {
  const its = offer.itineraries || [];
  const seats = offer.numberOfBookableSeats ?? null;
  const price = offer.price?.total || null;
  const currency = offer.price?.currency || "INR";

  const mapItin = (it) => {
    if (!it) return null;
    const segs = it.segments || [];
    const first = segs[0];
    const last = segs[segs.length - 1];

    const carrierCode =
      first?.carrierCode || first?.operating?.carrierCode || "";
    const airlineName = AIRLINES[carrierCode] || carrierCode;

    const flightNum = `${carrierCode} ${first?.number || ""}`.trim();
    const aircraft = first?.aircraft?.code || "";
    const from = `${first?.departure?.iataCode || ""}${
      first?.departure?.terminal ? ` (${first.departure.terminal})` : ""
    }`;
    const to = `${last?.arrival?.iataCode || ""}${
      last?.arrival?.terminal ? ` (${last.arrival.terminal})` : ""
    }`;
    const departAt = first?.departure?.at || "";
    const arriveAt = last?.arrival?.at || "";
    const duration = (it.duration || "")
      .replace(/^PT/, "")
      .replace("H", "h")
      .replace("M", "m");

    return {
      airlineName,
      flight: aircraft ? `${flightNum} (${aircraft})` : flightNum,
      from,
      to,
      departAt,
      arriveAt,
      duration,
      price,
      currency,
      bookableSeats: seats,
    };
  };

  return {
    outbound: mapItin(its[0]),
    return: its[1] ? mapItin(its[1]) : null,
  };
}

// ========= Flights Endpoint =========
app.get("/api/flights", async (req, res) => {
  try {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      children = 0,
    } = req.query;

    if (!origin || !destination || !departureDate) {
      return res
        .status(400)
        .json({ error: "Missing flight search parameters" });
    }

    const token = await authenticateAmadeus();

    const baseParams = {
      adults: Number(adults),
      children: Number(children),
      currencyCode: "INR",
      max: 50,
    };

    const outParams = {
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      ...baseParams,
    };

    const retParams = returnDate
      ? {
          originLocationCode: destination,
          destinationLocationCode: origin,
          departureDate: returnDate,
          ...baseParams,
        }
      : null;

    const outReq = axios.get(
      "https://test.api.amadeus.com/v2/shopping/flight-offers",
      { headers: { Authorization: `Bearer ${token}` }, params: outParams }
    );

    const retReq = retParams
      ? axios.get(
          "https://test.api.amadeus.com/v2/shopping/flight-offers",
          { headers: { Authorization: `Bearer ${token}` }, params: retParams }
        )
      : Promise.resolve({ data: { data: [] } });

    const [outRes, retRes] = await Promise.all([outReq, retReq]);

    const outboundCards = (outRes.data?.data || [])
      .map(mapOffer)
      .map((o) => o.outbound)
      .filter(Boolean);

    const returnCards = (retRes.data?.data || [])
      .map(mapOffer)
      .map((o) => o.return)
      .filter(Boolean);

    res.json({ outbound: outboundCards, return: returnCards });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.json({ outbound: [], return: [] });
    }
    console.error("Flight search error:", err.response?.data || err.message);
    res.status(500).json({ error: "Flight search failed" });
  }
});

// ========= Hotels Endpoint (Booking.com scraper via Python) =========
app.get("/api/hotels", (req, res) => {
  const {
    searchMode = "city",
    location,
    city,
    checkInDate,
    checkOutDate,
    adults = 1,
    children = 0,
    ages = "",
  } = req.query;

  const resolvedLocation =
    location || city || ""; // allow both styles from frontend

  if (!resolvedLocation || !checkInDate || !checkOutDate) {
    return res
      .status(400)
      .json({ error: "Missing hotel search parameters" });
  }

  const childrenAges = ages
    ? ages
        .split(",")
        .map((a) => Number(a.trim()))
        .filter((n) => !Number.isNaN(n))
    : [];

  const params = {
    search_mode: searchMode, // "city" or "name"
    location: resolvedLocation,
    checkin_date: checkInDate,
    checkout_date: checkOutDate,
    num_adults: Number(adults),
    num_children: Number(children),
    children_ages: childrenAges,
  };

  const proc = spawn(
    "python",
    [path.join(__dirname, "booking_scraper.py"), JSON.stringify(params)],
    {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    }
  );

  let out = "";
  let err = "";

  proc.stdout.on("data", (d) => (out += d.toString()));
  proc.stderr.on("data", (d) => (err += d.toString()));
  proc.on("close", (code) => {
    if (code !== 0) {
      console.error("Scraper error:", err || `exit code ${code}`);
      return res.status(500).json({ error: "Hotel scraper failed" });
    }
    try {
      res.json(JSON.parse(out));
    } catch (parseErr) {
      console.error("Scraper JSON parse error:", parseErr, "\nRaw Output:", out);
      res.status(500).json({ error: "Invalid data received from scraper" });
    }
  });
});

// ========= Popular Destinations Endpoint (Klook scraper via Python) =========
app.get("/api/popular-destinations", (req, res) => {
  const { country = "", limit = 12 } = req.query;

  const params = { country, limit: Number(limit) };

  const proc = spawn(
    "python",
    [path.join(__dirname, "klook_scraper.py"), JSON.stringify(params)],
    {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    }
  );

  let out = "";
  let err = "";

  proc.stdout.on("data", (d) => (out += d.toString()));
  proc.stderr.on("data", (d) => (err += d.toString()));
  proc.on("close", (code) => {
    if (code !== 0) {
      console.error("Klook scraper error:", err || `exit code ${code}`);
      return res
        .status(500)
        .json({ error: "Popular destinations fetch failed" });
    }
    try {
      res.json(JSON.parse(out));
    } catch (parseErr) {
      console.error("Klook JSON parse error:", parseErr, "\nRaw Output:", out);
      res
        .status(500)
        .json({ error: "Invalid data received from Klook scraper" });
    }
  });
});

// ========= Start server =========
app.listen(5000, () => {
  console.log("✅ Backend running on port 5000");
});