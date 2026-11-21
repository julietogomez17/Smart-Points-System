
import React, { useEffect, useRef, useState } from 'react';

function GPSTestPage() {
  const [status, setStatus] = useState('Ready to test GPS');
  const [reading, setReading] = useState(null);
  const [best, setBest] = useState(null);
  const [count, setCount] = useState(0);
  const [testing, setTesting] = useState(false);

  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const bestRef = useRef(null);
  const activeRef = useRef(false);

  const stopGPS = () => {
    activeRef.current = false;

    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setTesting(false);
  };

  useEffect(() => {
    return () => {
      activeRef.current = false;

      if (watchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const startGPS = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported.');
      return;
    }

    if (!window.isSecureContext) {
      setStatus('HTTPS is required for GPS testing.');
      return;
    }

    stopGPS();

    bestRef.current = null;
    setBest(null);
    setReading(null);
    setCount(0);
    setTesting(true);
    setStatus('Collecting GPS readings...');

    activeRef.current = true;

    timerRef.current = setTimeout(() => {
      if (!activeRef.current) return;

      setStatus(
        bestRef.current
          ? 'GPS test complete.'
          : 'No valid GPS reading received.'
      );

      stopGPS();
    }, 20000);

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!activeRef.current) return;

        const { latitude, longitude, accuracy } = position.coords;

        const age = Date.now() - position.timestamp;

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) ||
          accuracy < 0 ||
          age < 0 ||
          age > 5000
        ) {
          return;
        }

        const result = {
          latitude,
          longitude,
          accuracy,
          timestamp: position.timestamp
        };

        setReading(result);
        setCount((previous) => previous + 1);

        if (
          !bestRef.current ||
          result.accuracy < bestRef.current.accuracy
        ) {
          bestRef.current = result;
          setBest(result);
        }

        if (result.accuracy <= 20) {
          setStatus('Target accuracy reached!');
          stopGPS();
        }
      },
      (error) => {
        if (!activeRef.current) return;

        if (error.code === 1) {
          setStatus('Location permission denied.');
          stopGPS();
        } else {
          setStatus(
            'Waiting for location: ' + error.message
          );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  const cardStyle = {
    background: 'white',
    padding: 20,
    borderRadius: 14,
    marginBottom: 16,
    boxShadow: '0 3px 12px rgba(0,0,0,0.08)'
  };

  const buttonStyle = {
    padding: '14px 20px',
    border: 0,
    borderRadius: 10,
    background: '#164e9b',
    color: 'white',
    fontSize: 16,
    cursor: 'pointer',
    marginRight: 8,
    marginBottom: 8
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      padding: '30px 16px',
      color: '#172033'
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1>CitiPoints GPS Test</h1>
        <p>
          Test smartphone GPS accuracy before deploying
          the complete CitiPoints system.
        </p>

        <div style={cardStyle}>
          <h3>GPS Collection</h3>
          <p>{status}</p>

          <button
            type="button"
            style={buttonStyle}
            onClick={startGPS}
            disabled={testing}
          >
            {testing ? 'Collecting GPS...' : 'Start GPS Test'}
          </button>

          {testing && (
            <button
              type="button"
              style={{
                ...buttonStyle,
                background: '#64748b'
              }}
              onClick={() => {
                stopGPS();
                setStatus('GPS test stopped.');
              }}
            >
              Stop
            </button>
          )}

          <p>Readings received: {count}</p>
        </div>

        <div style={cardStyle}>
          <h3>Latest GPS Reading</h3>

          {reading ? (
            <>
              <p>Latitude: {reading.latitude}</p>
              <p>Longitude: {reading.longitude}</p>
              <p>Accuracy: ±{reading.accuracy.toFixed(2)} m</p>
            </>
          ) : (
            <p>No reading yet.</p>
          )}
        </div>

        <div style={cardStyle}>
          <h3>Best GPS Reading</h3>

          {best ? (
            <>
              <h2>±{best.accuracy.toFixed(2)} meters</h2>
              <p>Latitude: {best.latitude}</p>
              <p>Longitude: {best.longitude}</p>
              <p>
                {best.accuracy <= 20
                  ? 'Good reported GPS accuracy'
                  : 'GPS accuracy may need improvement'}
              </p>
            </>
          ) : (
            <p>Waiting for GPS...</p>
          )}
        </div>

        <p style={{ fontSize: 13, color: '#64748b' }}>
          GPS accuracy is reported by your device.
          It does not independently prove attendance.
        </p>
      </div>
    </div>
  );
}

export default GPSTestPage;
