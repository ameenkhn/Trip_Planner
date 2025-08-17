# Trip Planner (Flights + Hotels + Popular Destinations)

A full‑stack web app to plan trips quickly:
- Flights via Amadeus API (prices in INR)
- Hotels via Booking.com scraper (Python Playwright + BeautifulSoup)
- Popular Destinations via Klook scraper (Python Playwright + BeautifulSoup)
- React frontend, Node/Express backend, Python scrapers spawned from Node

Demo flow: Search flights, find hotels (by city or hotel name), and explore popular destinations—all in one interface.

***

## Features

- Flights
  - One‑way and round‑trip search
  - Prices requested in INR
  - Airline code → name mapping
  - Bookable seats, durations, departure/arrival times

- Hotels
  - Search by City or by specific Hotel Name
  - INR price parsing from Booking results
  - Consent handling, lazy‑load scroll, resilient selectors
  - Exact‑match prioritization for “By Name”

- Popular Destinations (Klook)
  - On‑demand load of destination cards (name, image, tagline, link)
  - Hardened scraper with consent handling and lazy‑load scroll
  - Optional country and limit params

- Frontend UX
  - Clean panels for Flights, Hotels, and Popular Destinations
  - Loading/error states
  - Light/Dark mode toggle

***

## Tech Stack

- Frontend: React, Axios, CSS
- Backend: Node.js, Express
- Scrapers: Python, Playwright, BeautifulSoup
- API: Amadeus (test environment)

***

## Project Structure

```
.
├─ backend/
│  ├─ index.js                 # Express API (flights, hotels, popular)
│  ├─ booking_scraper.py       # Booking.com scraper
│  ├─ klook_scraper.py         # Klook destinations scraper
│  └─ .env                     # API keys (not committed)
├─ frontend/
│  ├─ src/
│  │  ├─ App.js                # React UI (Flights/Hotels/Klook)
│  │  └─ App.css
│  └─ package.json
└─ README.md
```

***

## Prerequisites

- Node.js 18+
- Python 3.9+ with pip
- Playwright browsers installed for Python
- Amadeus test API credentials

***

## Setup

1) Clone and install
```
git clone 
cd /frontend
npm install
cd ../backend
npm install
```

2) Backend environment (.env in backend/)
```
AMADEUS_API_KEY=your_amadeus_key
AMADEUS_API_SECRET=your_amadeus_secret
```

3) Python deps (inside backend/)
```
python -m pip install playwright beautifulsoup4
python -m playwright install
```

4) Run backend (inside backend/)
```
node index.js
```
Backend starts on http://localhost:5000

5) Run frontend (in another terminal, inside frontend/)
```
npm start
```
Frontend runs on http://localhost:3000

***

## Usage

- Flights
  - Enter IATA codes (e.g., DEL → BOM), dates, passengers.
  - Toggle One‑way / Round trip.
  - Click “Search Flights.” Prices are returned in INR.

- Hotels
  - Choose Search mode: By City or By Name.
  - Enter City (e.g., New Delhi) or Hotel Name (e.g., Taj Palace).
  - Provide check‑in/out dates, guests, and children ages (comma‑separated).
  - Click “Search Hotels.”

- Popular Destinations
  - Click “🌍 Popular Destinations” in header to load Klook results.

***

## API Endpoints

- GET /api/city-autocomplete
  - Query: keyword

- GET /api/flights
  - Query: origin, destination, departureDate, [returnDate], [adults], [children]
  - Returns: outbound[], return[]

- GET /api/hotels
  - Query:
    - searchMode=city|name
    - location=
    - checkInDate, checkOutDate
    - [adults], [children], [ages="4,6"]
  - Returns: array of hotels with name, price, duration, person_details

- GET /api/popular-destinations
  - Query: [country], [limit=12]
  - Returns: array of { name, image, link, tagline }

***

## Key Implementation Notes

- Flights in INR
  - All Amadeus requests pass currencyCode="INR".

- Booking scraper reliability
  - Handles cookie/consent banners.
  - Progressive scroll to trigger lazy loading.
  - “Wait for any selector” strategy for resilient DOM changes.
  - Optional exact‑match prioritization when searchMode="name".
  - On failure, the scraper can save HTML/screenshot to debug.

- Klook scraper considerations
  - Uses broader anchor-based selectors (destination/city links).
  - Same consent + scroll strategy.
  - Some locales may present bot challenges; consider caching or a proxy if needed.

***

## Scripts (convenience)

Backend:
- Start: `node index.js`

Frontend:
- Start: `npm start`

***
