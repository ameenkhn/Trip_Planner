import React, { useState } from 'react';
import axios from 'axios';

function StarRating({ rating }) {
  const stars = Math.round(Number(rating)) || 0;
  return (
    <span style={{ color: '#f5c518', fontSize: 16 }}>
      {'★'.repeat(stars)}
      <span style={{ color: '#ddd' }}>{'★'.repeat(5 - stars)}</span>
      {stars === 0 && <span style={{ color: "#999" }}> No rating</span>}
    </span>
  );
}
function Spinner() {
  return (
    <div style={{
      textAlign: "center", margin: "24px 0",
      display: "flex", justifyContent: "center"
    }}>
      <div className="lds-dual-ring"></div>
      <style>{`
        .lds-dual-ring {
          display: inline-block;
          width: 36px;
          height: 36px;
        }
        .lds-dual-ring:after {
          content: " ";
          display: block;
          width: 28px;
          height: 28px;
          margin: 4px;
          border-radius: 50%;
          border: 4px solid #008cff;
          border-color: #008cff transparent #008cff transparent;
          animation: lds-dual-ring 1.2s linear infinite;
        }
        @keyframes lds-dual-ring {
          0% { transform: rotate(0deg);}
          100% { transform: rotate(360deg);}
        }
      `}</style>
    </div>
  );
}

const DEFAULT_HOTEL_IMG = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=60";

function App() {
  const [flightType, setFlightType] = useState('oneway'); 
  const [flightResults, setFlightResults] = useState([]);
  const [returnResults, setReturnResults] = useState([]);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [flightForm, setFlightForm] = useState({ adults: 1, children: 0 });

  const [fullHotelList, setFullHotelList] = useState([]);
  const [hotelOffers, setHotelOffers] = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(false);

  const [error, setError] = useState('');

  function handleFlightFormChange(e) {
    const { name, value } = e.target;
    setFlightForm(form => ({ ...form, [name]: value }));
  }

  async function searchFlights(e) {
    e.preventDefault();
    setError('');
    setLoadingFlight(true);

    setFlightResults([]);
    setReturnResults([]);

    const origin = e.target.origin.value.trim().toUpperCase();
    const destination = e.target.destination.value.trim().toUpperCase();
    const departureDate = e.target.departureDate.value;
    const returnDate = flightType === 'roundtrip' ? e.target.returnDate.value : '';
    const adults = Number(flightForm.adults) || 1;
    const children = Number(flightForm.children) || 0;

    if (!origin || !destination || !departureDate) {
      setError('Please fill all required flight search fields.');
      setLoadingFlight(false);
      return;
    }

    if (flightType === "oneway") {
      try {
        const res = await axios.get('http://localhost:5000/api/flights', {
          params: { origin, destination, departureDate, adults, children }
        });
        const flights = res.data.data || [];
        setFlightResults(flights.slice(0, 10));
      } catch (err) {
        setError('Flight fetch failed: ' + (err.response?.data?.error || err.message));
      }
      setLoadingFlight(false);
      return;
    }

    if (flightType === "roundtrip") {
      if (!returnDate) {
        setError('Return date required for round trips.');
        setLoadingFlight(false);
        return;
      }
      if (returnDate < departureDate) {
        setError('Return date cannot be before departure date.');
        setLoadingFlight(false);
        return;
      }
      try {
        const dep = await axios.get('http://localhost:5000/api/flights', {
          params: { origin, destination, departureDate, adults, children }
        });
        setFlightResults(dep.data.data?.slice(0, 10) || []);
        const ret = await axios.get('http://localhost:5000/api/flights', {
          params: {
            origin: destination,    
            destination: origin,
            departureDate: returnDate,
            adults, children
          }
        });
        setReturnResults(ret.data.data?.slice(0, 10) || []);
      } catch (err) {
        setError('Flight fetch failed: ' + (err.response?.data?.error || err.message));
      }
      setLoadingFlight(false);
    }
  }

  async function fetchHotelIds(cityCode) {
    try {
      const res = await axios.get('http://localhost:5000/api/hotel-ids', { params: { cityCode } });
      if (res.data?.data) return res.data.data;
      return [];
    } catch (err) {
      setError('Failed to fetch hotel IDs: ' + err.message);
      return [];
    }
  }
  async function fetchHotelOffers(hotelIdsStr, checkInDate, checkOutDate) {
    try {
      const res = await axios.get('http://localhost:5000/api/hotels', {
        params: { hotelIds: hotelIdsStr, checkInDate, checkOutDate },
      });
      return res.data.data ?? [];
    } catch (err) {
      setError('Hotel fetch failed: ' + (err.response?.data?.error || err.message));
      return [];
    }
  }
  async function searchHotels(e) {
    e.preventDefault();
    setError('');
    setFullHotelList([]);
    setHotelOffers([]);
    setLoadingHotels(true);

    const cityCodeRaw = e.target.cityCode?.value;
    const checkInDate = e.target.checkInDate?.value;
    const checkOutDate = e.target.checkOutDate?.value;
    if (!cityCodeRaw) {
      setError('Please enter a city code.');
      setLoadingHotels(false);
      return;
    }
    const cityCode = cityCodeRaw.trim().toUpperCase();
    if (!checkInDate || !checkOutDate) {
      setError('Please enter check-in and check-out dates.');
      setLoadingHotels(false);
      return;
    }
    if (checkOutDate <= checkInDate) {
      setError('Check-out date must be after check-in date.');
      setLoadingHotels(false);
      return;
    }
    try {
      const hotelsFull = await fetchHotelIds(cityCode);
      if (hotelsFull.length === 0) {
        setError(`No hotels found for city code ${cityCode}`);
        setLoadingHotels(false);
        return;
      }
      setFullHotelList(hotelsFull);
      const hotelIdsStr = hotelsFull.slice(0, 50).map(h => h.hotelId).join(',');
      const offers = await fetchHotelOffers(hotelIdsStr, checkInDate, checkOutDate);
      setHotelOffers(offers);
    } catch (err) {
      setError('Hotel search error: ' + (err.message || err));
    }
    setLoadingHotels(false);
  }
  function getHotelsWithOffers() {
    const offersMap = new Map();
    hotelOffers.forEach(offer => {
      if (offer.hotel && offer.hotel.hotelId) {
        offersMap.set(offer.hotel.hotelId, offer.offers || []);
      }
    });
    const hotelsMerged = fullHotelList.map(hotel => ({
      ...hotel,
      offers: offersMap.get(hotel.hotelId) || [],
    }));
    hotelsMerged.sort((a, b) => (b.offers.length > 0 ? 1 : 0) - (a.offers.length > 0 ? 1 : 0));
    return hotelsMerged.slice(0, 10);
  }

  function FlightOffer({ offer }) {
    const itinerary = offer.itineraries?.[0];
    return (
      <div className="flight-card">
        <div style={{fontWeight:'600',color:'#246'}}>Flight: {offer.id}</div>
        {itinerary?.segments.map((seg, i) => (
          <div key={i} className="flight-segment">
            <div>
              <span className="flight-badge">{seg.carrierCode} {seg.number}</span>
              &nbsp;{seg.departure.iataCode} <b>→</b> {seg.arrival.iataCode}
            </div>
            <div className="flight-time">
              <span>
                {new Date(seg.departure.at).toLocaleString()}
                {seg.departure.terminal && <span style={{color: '#999'}}> (T{seg.departure.terminal})</span>}
              </span>
              {' → '}
              <span>
                {new Date(seg.arrival.at).toLocaleString()}
                {seg.arrival.terminal && <span style={{color: '#999'}}> (T{seg.arrival.terminal})</span>}
              </span>
              &nbsp;<span className="flight-dur">{seg.duration.replace('PT','').toLowerCase()}</span>
            </div>
          </div>
        ))}
        <div className="flight-footer">
          <span className="flight-price">{offer.price.currency === "INR" ? "₹" : offer.price.currency} {offer.price.total}</span>
          <span style={{marginLeft:12}}>Bookable Seats: {offer.numberOfBookableSeats}</span>
        </div>
      </div>
    );
  }

  function HotelOfferExtended({ hotel }) {
    const available = hotel.offers.length > 0;
    const hotelImg = hotel.picture || DEFAULT_HOTEL_IMG;
    return (
      <div className="hotel-card">
        <img src={hotelImg} alt={hotel.name} className="hotel-image"/>
        <div className="hotel-details">
          <div className="hotel-head">
            <span className="hotel-name">{hotel.name}</span>
            <span className={"hotel-status " + (available ? "avail" : "soldout")}>
              {available ? "AVAILABLE" : "SOLD OUT"}
            </span>
          </div>
          {hotel.rating && <div style={{marginBottom:3}}><StarRating rating={hotel.rating} /></div>}
          <div className="hotel-address">{hotel.address?.lines?.join(', ')}, {hotel.address?.cityName}</div>
          {available ? (
            <>
              <div className="hotel-offers-title">{hotel.offers.length} Room Offer(s):</div>
              {hotel.offers.map((roomOffer, idx) => (
                <div key={idx} className="hotel-room-offer">
                  <div>
                    <span className="hotel-price">
                      ₹{Number(roomOffer.price.total).toLocaleString()}
                    </span>
                    &nbsp; | &nbsp;
                    {roomOffer.room?.typeEstimated?.category || "N/A"}
                  </div>
                  <div className="room-dates">
                    {roomOffer.checkInDate} → {roomOffer.checkOutDate}
                  </div>
                  <div>Board: {roomOffer.boardType || "N/A"}</div>
                </div>
              ))}
            </>
          ) : <div className="hotel-soldout-text">No rooms available for selected dates.</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 24, fontFamily: 'Inter, Arial, sans-serif', background: '#f4f7fd' }}>
      <h1 style={{color:'#254c7e',margin:'8px 0'}}>Trip Planner</h1>
      <div className="app-block flight-bg">
        <h2>Flight Search</h2>
        <form onSubmit={searchFlights} className="search-form">
          <div style={{display:'flex',gap:14, alignItems:'center'}}>
            <label>
              <input type="radio" name="flightType" checked={flightType==="oneway"}
                onChange={()=>setFlightType("oneway")}
                style={{verticalAlign:'middle',marginRight:4}}/>
              One-way
            </label>
            <label>
              <input type="radio" name="flightType" checked={flightType==="roundtrip"}
                onChange={()=>setFlightType("roundtrip")}
                style={{verticalAlign:'middle',marginRight:4}}/>
              Round-trip
            </label>
          </div>
          <input name="origin" placeholder="Origin (e.g. DEL)" required maxLength={3} autoComplete="off" />
          <input name="destination" placeholder="Destination (e.g. BOM)" required maxLength={3} autoComplete="off" />
          <input name="departureDate" type="date" required />
          {flightType === "roundtrip" && (
            <input name="returnDate" type="date" required />
          )}
          <label style={{margin:'0 7px'}}>Adults
            <select name="adults" value={flightForm.adults} onChange={handleFlightFormChange} style={{marginLeft:5}}>
              {[1,2,3,4,5,6].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={{margin:'0 7px'}}>Children
            <select name="children" value={flightForm.children} onChange={handleFlightFormChange} style={{marginLeft:5}}>
              {[0,1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button type="submit" className="search-btn">Search Flights</button>
        </form>
        {loadingFlight && <Spinner />}
        {error && <div className="error">{error}</div>}

        {flightResults && flightResults.length > 0 && (
          <>
          <h3 style={{marginTop:24}}>Top 10 Departure {flightType==="roundtrip"?'':'Flights'}</h3>
          <div className="flight-list">
            {flightResults.map(offer => (
              <FlightOffer key={offer.id} offer={offer} />
            ))}
          </div>
          </>
        )}

        {flightType==="roundtrip" && returnResults && returnResults.length > 0 && (
          <>
            <h3 style={{marginTop:24}}>Top 10 Return Flights</h3>
            <div className="flight-list">
              {returnResults.map(offer => (
                <FlightOffer key={offer.id} offer={offer} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="app-block hotel-bg">
        <h2>Hotel Search</h2>
        <form onSubmit={searchHotels} className="search-form">
          <input name="cityCode" placeholder="City Code (e.g. BOM)" required maxLength={3} autoComplete="off" />
          <input name="checkInDate" type="date" required />
          <input name="checkOutDate" type="date" required />
          <button type="submit" className="search-btn">Search Hotels</button>
        </form>
        {loadingHotels && <Spinner />}
        {error && <div className="error">{error}</div>}
        {fullHotelList.length === 0 && !loadingHotels && <div>No hotels found.</div>}
        {fullHotelList.length > 0 && (
          <>
            <h3 style={{marginTop:24}}>Top 10 Hotels in City</h3>
            <div className="hotel-list">
              {getHotelsWithOffers().map(hotel => (
                <HotelOfferExtended key={hotel.hotelId} hotel={hotel} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Inline CSS styles */}
      <style>{`
        .app-block { background: #fff; border-radius: 14px; margin-bottom: 32px; box-shadow: 0 3px 12px #0001; padding: 24px; }
        .hotel-bg { background: linear-gradient(136deg,#b8d8fa 0,#eaf2fd 80%); }
        .flight-bg { background: linear-gradient(137deg,#e6f3f6 0,#cefaee 80%); }
        .search-form { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; align-items:center;}
        input[type="text"], input[type="date"], input, select { padding: 6px 10px; border: 1px solid #bbb; border-radius: 6px; background: #fafdff; font-size: 16px;}
        .search-btn { padding: 6px 22px; background: #246ade; color: #fff; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; transition: background .2s; }
        .search-btn:hover { background: #193c60; }
        .flight-list { display: flex; flex-direction: column; gap: 18px; }
        .flight-card { background: #fafcff; border-radius: 8px; box-shadow: 0 1px 5px #0002; padding: 16px 20px;}
        .flight-segment { font-size: 15px; margin-bottom: 2px;}
        .flight-badge { background: #2dcab6; color: #fff; font-size:13px; font-weight:600; border-radius: 4px; padding: 2px 8px; margin-right: 7px;}
        .flight-footer { margin-top: 2px; font-size: 16px; display:flex; gap:10px; align-items:center }
        .flight-dur { color: #47a9f0; font-size: 13px; margin-left: 9px;}
        .flight-price { font-weight: bold; font-size: 16px; color: #226fcf; background:#e6f7ff; padding:2.5px 8px; border-radius:5px;}
        .hotel-list { display: flex; flex-direction: column; gap: 20px; margin-top:8px; }
        .hotel-card { display:flex; background: #fafdff; border-radius:11px; box-shadow: 0 1px 6px #0002; overflow:hidden; min-height:116px;}
        .hotel-image { width: 120px; height: 98px; object-fit:cover; border-radius:11px 0 0 11px;}
        .hotel-details { flex:1; padding: 9px 17px 7px 15px; display:flex; flex-direction:column; justify-content:center;}
        .hotel-head { display:flex; align-items:center; gap:10px; margin-bottom:2.5px;}
        .hotel-name { font-size: 18px; font-weight: bold; color:#193c60;}
        .hotel-status { font-size:11px; font-weight: bold; border-radius:5px; padding:2.5px 9px; margin-left:5px; letter-spacing:1px;}
        .hotel-status.avail { background:#2eedaf1a; color:#1cbf7a;}
        .hotel-status.soldout { background:#eabfcf; color: #a54063; }
        .hotel-address { font-size: 14px; color: #888; margin-bottom: 7px; }
        .hotel-offers-title { font-size:14px; color:#277; font-weight: bold; margin-bottom:3px; margin-top:2px;}
        .hotel-room-offer { background: #ebfaf2; border-radius:7px; margin-bottom:8px; padding: 6px 9px 5px 9px; font-size: 15px;}
        .hotel-price { color: #37a807; background: #d2f7ce; border-radius:3px; padding:1px 8px; margin-right:7px; font-weight:bold;}
        .room-dates { color: #258af7; font-size: 13px; margin:3px 0;}
        .hotel-soldout-text { color: #b17f8b; margin:9px 0 0 2px; font-weight:600;}
        .error { color: #fff; background: #e64141e0; padding: 9px 16px; border-radius: 6px; margin-bottom: 16px; }
        @media (max-width:600px) {
          .app-block { padding:9px }
          .hotel-card, .flight-card { flex-direction:column; align-items:stretch; }
          .hotel-image { width: 100%; height:80px; border-radius:11px 11px 0 0;}
        }
      `}</style>
    </div>
  );
}

export default App;