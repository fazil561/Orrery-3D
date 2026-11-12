
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    maplibregl?: any;
  }
}

type Place = {
  name: string;
  country?: string;
  lat: number;
  lon: number;
};

export default function MapGlobe({ place }: { place: Place }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState('LOADING GLOBAL MAP');

  useEffect(() => {
    if (!hostRef.current || !window.maplibregl || mapRef.current) return;

    const map = new window.maplibregl.Map({
      container: hostRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [place.lon, place.lat],
      zoom: 1.35,
      minZoom: 0.5,
      maxZoom: 19,
      pitch: 0,
      bearing: 0,
      projection: 'globe',
      attributionControl: true,
      renderWorldCopies: false
    });

    mapRef.current = map;

    map.on('load', () => {
      map.setProjection({ type: 'globe' });

      // Create a visible, persistent observer marker.
      const pin = document.createElement('div');
      pin.className = 'orrery-location-pin';
      pin.innerHTML = `
        <span class="orrery-pin-pulse"></span>
        <span class="orrery-pin-core"></span>
      `;

      const popup = new window.maplibregl.Popup({
        offset: 20,
        closeButton: false,
        closeOnClick: false
      }).setHTML(
        `<div class="orrery-pin-popup">
          <strong>${place.name}</strong>
          <span>YOUR OBSERVING LOCATION</span>
        </div>`
      );

      markerRef.current = new window.maplibregl.Marker({
        element: pin,
        anchor: 'center'
      })
        .setLngLat([place.lon, place.lat])
        .setPopup(popup)
        .addTo(map);

      setStatus('GLOBAL ATLAS · OPENSTREETMAP DATA');
    });

    map.on('error', () => {
      setStatus('MAP TILE CONNECTION ISSUE · CHECK INTERNET');
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRef.current?.setLngLat([place.lon, place.lat]);

    map.flyTo({
      center: [place.lon, place.lat],
      zoom: Math.max(map.getZoom(), 3.2),
      speed: 0.75,
      curve: 1.35,
      essential: true
    });
  }, [place.lat, place.lon, place.name]);

  return (
    <div className="earth-atlas">
      <div ref={hostRef} className="earth-map-canvas" />

      <div className="earth-atlas-status">
        <span>{status}</span>
        <span>
          {place.name.toUpperCase()} · {place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°
        </span>
      </div>

      <div className="earth-atlas-hint">
        DRAG TO ROTATE · SCROLL TO EXPLORE · DOUBLE-CLICK TO ZOOM
      </div>
    </div>
  );
}
