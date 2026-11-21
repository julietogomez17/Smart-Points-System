
import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [10.3237, 123.9223];

const bluePin = L.divIcon({
  className: 'citipoints-custom-marker',
  html: `
    <div style="
      width:42px;
      height:42px;
      background:#2563eb;
      border:4px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 5px 16px rgba(37,99,235,.4);
      display:flex;
      align-items:center;
      justify-content:center;
      box-sizing:border-box;
    ">
      <div style="
        width:13px;
        height:13px;
        background:white;
        border-radius:50%;
      "></div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 42]
});

function PinSelector({ point, onPick }) {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    }
  });

  if (!point) return null;

  return (
    <Marker
      position={[point.lat, point.lng]}
      icon={bluePin}
      draggable
      eventHandlers={{
        dragend: (event) => {
          const position = event.target.getLatLng();
          onPick(position.lat, position.lng);
        }
      }}
    />
  );
}

function FlyToPin({ point }) {
  const map = useMap();

  const latitude = point?.lat;
  const longitude = point?.lng;

  useEffect(() => {
    if (
      latitude !== undefined &&
      longitude !== undefined
    ) {
      map.flyTo(
        [latitude, longitude],
        Math.max(map.getZoom(), 16),
        { duration: 0.8 }
      );
    }
  }, [map, latitude, longitude]);

  return null;
}

function MapControls() {
  const map = useMap();

  const controlStyle = {
    width: '38px',
    height: '38px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#fff',
    color: '#1e3a8a',
    fontSize: '23px',
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(15,23,42,.1)'
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: '16px',
        top: '16px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <button
        type="button"
        aria-label="Zoom in"
        style={controlStyle}
        onClick={() => map.zoomIn()}
      >
        +
      </button>

      <button
        type="button"
        aria-label="Zoom out"
        style={controlStyle}
        onClick={() => map.zoomOut()}
      >
        −
      </button>
    </div>
  );
}

export default function LocationPickerModal({
  initialLocation,
  initialLatitude,
  initialLongitude,
  initialCoverageRadius = 500,
  onConfirm,
  onClose
}) {



  const hasCoordinates =
    initialLatitude !== null &&
    initialLatitude !== undefined &&
    initialLatitude !== '' &&
    initialLongitude !== null &&
    initialLongitude !== undefined &&
    initialLongitude !== '' &&
    Number.isFinite(Number(initialLatitude)) &&
    Number.isFinite(Number(initialLongitude));

  const initialPoint = hasCoordinates
    ? {
        lat: Number(initialLatitude),
        lng: Number(initialLongitude)
      }
    : null;

  const [point, setPoint] = useState(initialPoint);
  const [address, setAddress] = useState(
    initialLocation || ''
  );
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const [coverageRadius, setCoverageRadius] = useState(() => {
  const value = Number(initialCoverageRadius);

  return Number.isFinite(value) &&
    value >= 50 &&
    value <= 3000
    ? value
    : 500;
});

  const pick = (lat, lng) => {
    setPoint({ lat, lng });

    setAddress(
      `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    );

    setSearchResults([]);
    setMessage(
      'Pin placed successfully. Drag the marker to adjust.'
    );
  };

  const searchLocation = async (event) => {
    event.preventDefault();

    if (!search.trim()) return;

    setBusy(true);
    setMessage('');
    setSearchResults([]);

    try {
      const viewbox = '123.75,10.55,124.10,10.10';

      const params = new URLSearchParams({
        format: 'json',
        addressdetails: '1',
        limit: '10',
        countrycodes: 'ph',
        viewbox,
        bounded: '0',
        q: search.trim()
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Search service unavailable');
      }

      const results = await response.json();

      const rankedResults = results
        .map((result) => {
          const location =
            result.display_name.toLowerCase();

          let priority = 0;

          if (location.includes('cebu')) {
            priority += 100;
          }

          if (
            location.includes('lapu-lapu') ||
            location.includes('lapu lapu') ||
            location.includes('mandaue')
          ) {
            priority += 50;
          }

          return { ...result, priority };
        })
        .sort((a, b) => b.priority - a.priority);

      if (rankedResults.length === 0) {
        setMessage(
          'No matching location found. Try a nearby landmark or select a point directly on the map.'
        );
        return;
      }

      setSearchResults(rankedResults);
      setMessage(
        'Choose the correct location from the results.'
      );
    } catch (error) {
      setMessage(
        'Location search failed. Try again or click the map.'
      );
    } finally {
      setBusy(false);
    }
  };

  const selectSearchResult = (result) => {
    setPoint({
      lat: Number(result.lat),
      lng: Number(result.lon)
    });

    setAddress(result.display_name);
    setSearchResults([]);
    setMessage(
      'Location selected. You can drag the pin to adjust it.'
    );
  };

  const buttonBase = {
    border: 'none',
    borderRadius: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(10, 24, 48, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select activity location"
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '94vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: '22px',
          boxShadow:
            '0 25px 80px rgba(0,0,0,.25)',
          boxSizing: 'border-box',
          color: '#172b4d',
          fontFamily: 'inherit'
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid #edf1f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#eaf1ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '25px'
              }}
            >
              📍
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: 750,
                  color: '#102b55'
                }}
              >
                Select Activity Location
              </h2>

              <p
                style={{
                  margin: '5px 0 0',
                  color: '#64748b',
                  fontSize: '13px'
                }}
              >
                Search an address or place a pin on the map.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close location picker"
            style={{
              ...buttonBase,
              width: '36px',
              height: '36px',
              background: '#f1f5f9',
              color: '#64748b',
              fontSize: '22px',
              flexShrink: 0
            }}
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '24px 28px' }}>
          <label
            htmlFor="location-search"
            style={{
              display: 'block',
              fontWeight: 650,
              fontSize: '13px',
              color: '#334155',
              marginBottom: '9px'
            }}
          >
            Search location
          </label>

          <form
            onSubmit={searchLocation}
            style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '14px'
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                border: '1px solid #d8e2ef',
                borderRadius: '12px',
                padding: '0 14px',
                background: '#f8fafc'
              }}
            >
              <span
                style={{
                  fontSize: '18px',
                  color: '#64748b'
                }}
              >
                ⌕
              </span>

              <input
                id="location-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search barangay, street, or landmark..."
                style={{
                  width: '100%',
                  minWidth: 0,
                  height: '46px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#172b4d',
                  fontSize: '14px'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{
                ...buttonBase,
                padding: '0 22px',
                background: '#2563eb',
                color: '#fff',
                opacity: busy ? 0.65 : 1
              }}
            >
              {busy ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* SEARCH RESULTS */}
          {searchResults.length > 0 && (
            <div
              style={{
                marginBottom: '14px',
                maxHeight: '185px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                background: '#fff',
                boxShadow:
                  '0 5px 18px rgba(15,23,42,.06)'
              }}
            >
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  type="button"
                  onClick={() => selectSearchResult(result)}
                  style={{
                    width: '100%',
                    padding: '13px 15px',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom:
                      '1px solid #f1f5f9',
                    background: '#fff',
                    color: '#334155',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start'
                  }}
                >
                  <span style={{ color: '#2563eb' }}>
                    📍
                  </span>
                  <span>{result.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {/* MAP */}
          <div
            style={{
              position: 'relative',
              height: 'min(45vh, 390px)',
              minHeight: '260px',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid #dbe5f1',
              background: '#eef3f9'
            }}
          >
            <MapContainer
              center={
                initialPoint
                  ? [initialPoint.lat, initialPoint.lng]
                  : DEFAULT_CENTER
              }
              zoom={initialPoint ? 16 : 13}
              zoomControl={false}
              style={{
                height: '100%',
                width: '100%'
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {point && (
  <Circle
    center={[point.lat, point.lng]}
    radius={coverageRadius}
    pathOptions={{
      color: '#2563eb',
      weight: 2.5,
      opacity: 0.95,
      fillColor: '#3b82f6',
      fillOpacity: 0.18,
      dashArray: '8 5'
    }}
  />
)}


              <PinSelector
                point={point}
                onPick={pick}
              />

              <FlyToPin point={point} />

              <MapControls />
            </MapContainer>

            <div
              style={{
                position: 'absolute',
                left: '14px',
                top: '14px',
                zIndex: 500,
                padding: '9px 13px',
                background: 'rgba(255,255,255,.95)',
                borderRadius: '10px',
                boxShadow:
                  '0 3px 12px rgba(15,23,42,.1)',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
                pointerEvents: 'none'
              }}
            >
              📍 Click anywhere to place a pin
            </div>
          </div>




              
{/* EVENT COVERAGE RADIUS */}
<div
  style={{
    marginTop: 18,
    padding: 20,
    border: '1px solid #dbe5f1',
    borderRadius: 16,
    background: '#ffffff'
  }}
>
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 8
    }}
  >
    <label
      htmlFor="event-coverage-radius"
      style={{
        color: '#17345e',
        fontSize: 15,
        fontWeight: 750
      }}
    >
      Event Coverage Radius
    </label>

    <span
      style={{
        background: '#dbeafe',
        color: '#1d4ed8',
        borderRadius: 10,
        padding: '7px 12px',
        fontSize: 15,
        fontWeight: 800
      }}
    >
      {coverageRadius.toLocaleString()} m
    </span>
  </div>

  <p
    style={{
      color: '#64748b',
      fontSize: 13,
      margin: '0 0 18px'
    }}
  >
    Maximum distance from the selected activity pin.
  </p>

  <input
    id="event-coverage-radius"
    type="range"
    min="50"
    max="3000"
    step="50"
    value={coverageRadius}
    onChange={(event) =>
      setCoverageRadius(Number(event.target.value))
    }
    style={{
      width: '100%',
      cursor: 'pointer',
      accentColor: '#2563eb'
    }}
  />

  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      color: '#64748b',
      fontSize: 12,
      marginTop: 8
    }}
  >
    <span>50 m</span>
    <span>3,000 m</span>
  </div>

  <div
    style={{
      marginTop: 20,
      background: '#eff6ff',
      border: '1px solid #dbeafe',
      borderRadius: 12,
      padding: 16
    }}
  >
    <div
      style={{
        fontWeight: 750,
        color: '#1d4ed8',
        fontSize: 14,
        marginBottom: 8
      }}
    >
      📍 GPS Verification Coverage
    </div>

    <p
      style={{
        margin: 0,
        fontSize: 13,
        color: '#334155',
        lineHeight: 1.7
      }}
    >
      Citizen photos taken within{' '}
      <strong>
        {coverageRadius.toLocaleString()} meters
      </strong>{' '}
      of the selected activity pin will be considered
      within the expected event area.
    </p>

    <p
      style={{
        margin: '9px 0 0',
        color: '#64748b',
        fontSize: 12
      }}
    >
      This radius will be used for future GPS-assisted
      participation verification. Location checks will
      support LGU review rather than automatically
      rejecting submissions.
    </p>
  </div>
</div>

          {/* SELECTED LOCATION CARD */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '13px',
              padding: '17px',
              background: '#f3f7ff',
              border: '1px solid #dbeafe',
              borderRadius: '14px',
              marginTop: '18px'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#dbeafe',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '21px',
                flexShrink: 0
              }}
            >
              📍
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                overflowWrap: 'anywhere'
              }}
            >
              <div
                style={{
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  marginBottom: '5px'
                }}
              >
                Selected Location
              </div>

              <div
                style={{
                  color: '#17345e',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: 1.5
                }}
              >
                {point
                  ? address
                  : 'No location selected yet'}
              </div>

              {point && (
                <div
                  style={{
                    marginTop: '9px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <span
                    style={{
                      padding: '5px 9px',
                      background: '#fff',
                      borderRadius: '7px',
                      fontSize: '12px',
                      color: '#475569'
                    }}
                  >
                    Lat: {point.lat.toFixed(6)}
                  </span>

                  <span
                    style={{
                      padding: '5px 9px',
                      background: '#fff',
                      borderRadius: '7px',
                      fontSize: '12px',
                      color: '#475569'
                    }}
                  >
                    Lng: {point.lng.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {message && (
            <p
              role="status"
              style={{
                fontSize: '12px',
                color: '#64748b',
                margin: '12px 2px 0'
              }}
            >
              {message}
            </p>
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '17px 28px',
            borderTop: '1px solid #edf1f7',
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: '10px',
            background: '#fff',
            borderRadius: '0 0 22px 22px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              ...buttonBase,
              padding: '12px 22px',
              border: '1px solid #dbe3ee',
              background: '#fff',
              color: '#475569'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!point}
            onClick={() =>
             onConfirm({
  location: address,
  latitude: point.lat,
  longitude: point.lng,
  coverage_radius_m: coverageRadius
})
            }
            style={{
              ...buttonBase,
              padding: '12px 24px',
              background: '#2563eb',
              color: '#fff',
              opacity: point ? 1 : 0.5,
              cursor: point ? 'pointer' : 'not-allowed',
              boxShadow: point
                ? '0 5px 15px rgba(37,99,235,.2)'
                : 'none'
            }}
          >
            ✓ Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
