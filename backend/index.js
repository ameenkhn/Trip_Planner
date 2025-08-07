require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let accessToken = '';
let tokenExpiry = 0;

async function authenticateAmadeus() {
  if (Date.now() < tokenExpiry) return accessToken;
  const response = await axios.post(
    'https://test.api.amadeus.com/v1/security/oauth2/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY,
      client_secret: process.env.AMADEUS_API_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  accessToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
  return accessToken;
}
app.get('/api/city-autocomplete', async (req, res) => {
  const { keyword } = req.query;
  if (!keyword || keyword.length < 2) {
    return res.json([]);  
  }
  try {
    const token = await authenticateAmadeus();
    const response = await axios.get('https://test.api.amadeus.com/v1/reference-data/locations', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        keyword,
        subType: 'CITY',
        'page[limit]': 10,
      }
    });
    const cities = response.data.data.map(city => ({
      id: city.id,
      name: city.name,
      iataCode: city.iataCode,
    }));
    res.json(cities);
  } catch (err) {
    console.error('City autocomplete error:', err.response?.data || err.message);
    res.status(500).json([]);
  }
});

app.get('/api/flights', async (req, res) => {
  try {
    const { origin, destination, departureDate, adults = 1, children = 0 } = req.query;
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({ error: "Missing flight search param." });
    }
    const token = await authenticateAmadeus();
    console.log('Flight params:', { origin, destination, departureDate, adults, children });
    const response = await axios.get(
      'https://test.api.amadeus.com/v2/shopping/flight-offers',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          originLocationCode: origin,
          destinationLocationCode: destination,
          departureDate,
          adults: 1,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.get('/api/hotel-ids', async (req, res) => {
  try {
    const { cityCode } = req.query;
    const token = await authenticateAmadeus();
    const response = await axios.get(
      'https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { cityCode },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('HotelIdsRequestError:', err?.response?.data || err.message);
    res.status(500).json({ error: err.toString(), details: err?.response?.data });
  }
});

app.get('/api/hotels', async (req, res) => {
  try {
    const { hotelIds, checkInDate, checkOutDate } = req.query;
    const token = await authenticateAmadeus();
    const response = await axios.get(
      'https://test.api.amadeus.com/v3/shopping/hotel-offers',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          hotelIds, 
          checkInDate,
          checkOutDate,
          adults: 1,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('HotelRequestError:', err?.response?.data || err.message);
    res.status(500).json({ error: err.toString(), details: err?.response?.data });
  }
});

app.listen(5000, () => console.log('Backend running on port 5000'));