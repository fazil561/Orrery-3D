
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

function distanceKm(a: Place, b: Place) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) *
    Math.cos(rad(b.lat)) *
    Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export default function MapGlobe({ place }: { place: Place }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const placeRef = useRef(place);

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('LOADING GLOBAL MAP');

  placeRef.current = place;

  useEffect(() => {
    if (!hostRef.current || !window.maplibregl || mapRef.current) return;

    const map = new window.maplibregl.Map({
      container: hostRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [placeRef.current.lon, placeRef.current.lat],
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

      const pin = document.createElement('div');
      pin.className = 'orrery-location-pin';
      pin.innerHTML = `
        <span class="orrery-pin-pulse"></span>
        <span class="orrery-pin-core"></span>
      `;

      const popupContent = document.createElement('div');
      popupContent.className = 'orrery-pin-popup';

      const name = document.createElement('strong');
      name.textContent = placeRef.current.name;

      const description = document.createElement('span');
      description.textContent = 'YOUR OBSERVING LOCATION';

      popupContent.append(name, description);

      const popup = new window.maplibregl.Popup({
        offset: 20,
        closeButton: false,
        closeOnClick: false
      }).setDOMContent(popupContent);

      markerRef.current = new window.maplibregl.Marker({
        element: pin,
        anchor: 'center'
      })
        .setLngLat([
          placeRef.current.lon,
          placeRef.current.lat
        ])
        .setPopup(popup)
        .addTo(map);

      setReady(true);
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

    if (!map || !ready) return;

    const previous = map.getCenter();
    const oldPlace: Place = {
      name: 'Previous location',
      lat: previous.lat,
      lon: previous.lng
    };

    const distance = distanceKm(oldPlace, place);

    markerRef.current?.setLngLat([
      place.lon,
      place.lat
    ]);

    const popup = markerRef.current?.getPopup();

    if (popup) {
      const content = document.createElement('div');
      content.className = 'orrery-pin-popup';

      const name = document.createElement('strong');
      name.textContent = place.name;

      const description = document.createElement('span');
      description.textContent = 'YOUR OBSERVING LOCATION';

      content.append(name, description);
      popup.setDOMContent(content);
    }

    // Longer journeys receive a slower, more cinematic flight.
    const duration = Math.min(
      6500,
      Math.max(1800, 1800 + distance * 0.012)
    );

    setStatus(
      distance > 1000
        ? 'TRAVELLING ACROSS THE GLOBE…'
        : 'APPROACHING OBSERVATION POINT…'
    );

    map.flyTo({
      center: [place.lon, place.lat],
      zoom: Math.max(map.getZoom(), 4.2),
      curve: 1.8,
      duration,
      easing: (t: number) =>
        t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2,
      essential: true
    });

    map.once('moveend', () => {
      setStatus('GLOBAL ATLAS · ' + place.name.toUpperCase());
    });
  }, [place.lat, place.lon, place.name, ready]);

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
