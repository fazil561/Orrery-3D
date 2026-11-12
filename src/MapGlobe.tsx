
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
      setStatus('GLOBAL ATLAS · OPENSTREETMAP DATA');
    });

    map.on('error', () => {
      setStatus('MAP TILE CONNECTION ISSUE · CHECK INTERNET');
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [place.lon, place.lat],
      zoom: Math.max(map.getZoom(), 3.2),
      speed: 0.75,
      curve: 1.35,
      essential: true
    });
  }, [place.lat, place.lon]);

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
