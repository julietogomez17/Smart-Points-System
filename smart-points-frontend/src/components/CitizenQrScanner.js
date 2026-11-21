
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function CitizenQrScanner({ onScan, onClose, disabled = false }) {
  const onScanRef = useRef(onScan);
  const scanLockedRef = useRef(false);

  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    const startCamera = async () => {
      try {
        // Wait for the component to finish mounting.
        await new Promise((resolve) => {
          setTimeout(resolve, 150);
        });

        if (cancelled) return;

        scanner = new Html5Qrcode('citipoints-qr-reader', {
          verbose: false
        });

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 }
          },
          async (decodedText) => {
            if (cancelled || scanLockedRef.current) return;

            scanLockedRef.current = true;

            try {
              await onScanRef.current(decodedText);
            } catch (error) {
              console.error('QR scan processing error:', error);
            }
          },
          () => {
            // Ignore frames without a QR code.
          }
        );

        if (!cancelled) {
          setCameraReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setCameraError(
            error?.message ||
            'Unable to start camera. Check permissions.'
          );
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;

      const stopCamera = async () => {
        if (!scanner) return;

        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
        } catch (error) {
          console.warn('Camera stop error:', error);
        }

        try {
          scanner.clear();
        } catch (error) {
          console.warn('Camera cleanup error:', error);
        }
      };

      stopCamera();
    };
  }, []);

  return (
    <div className="citizen-qr-scanner">
     <div className="citizen-qr-camera-container">
  <div
    id="citipoints-qr-reader"
    className="citizen-qr-reader"
  />

  {cameraReady && !cameraError && (
   <div className="citizen-qr-scan-overlay">
  <div className="citizen-qr-scan-line" />
</div>
  )}
</div>

      {cameraError ? (
        <p className="citizen-qr-error">{cameraError}</p>
      ) : !cameraReady ? (
        <p>Starting camera...</p>
      ) : (
        <p>Point your camera at the activity QR code.</p>
      )}

      <button
        type="button"
        className="citizen-qr-close-btn"
        onClick={onClose}
        disabled={disabled}
      >
        Close Scanner
      </button>
    </div>
  );
}

export default CitizenQrScanner;
