
import SharedMoonSurface from './MoonSurface';
import EarthSurface from './EarthSurface';
import EarthExplorer from './EarthExplorer';
import CityView from './CityView';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';

type Vec = { x: number; y: number; z: number };

type Place = {
  name: string;
  country?: string;
  lat: number;
  lon: number;
  timezone?: string;
};

const DEFAULT_PLACE: Place = {
  name: 'BTM Layout, Bengaluru',
  country: 'India',
  lat: 12.9166,
  lon: 77.6101,
  timezone: 'Asia/Kolkata'
};

const v = (p: { x: number; y: number; z: number }): Vec => ({
  x: p.x,
  y: p.y,
  z: p.z
});

const mul = (a: Vec, n: number): Vec => ({
  x: a.x * n,
  y: a.y * n,
  z: a.z * n
});

const add = (a: Vec, b: Vec): Vec => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z
});

const mag = (a: Vec) => Math.hypot(a.x, a.y, a.z) || 1;
const norm = (a: Vec) => mul(a, 1 / mag(a));

const AU_KM = 149597870.7;
const AU_SCENE = 5;
const MOON_BOOST = 110;
const OBLIQUITY = 23.4392911 * Math.PI / 180;

function toEclipticScene(
  vector: { x: number; y: number; z: number },
  scale = 1
): Vec {
  const yEcliptic =
    vector.y * Math.cos(OBLIQUITY) +
    vector.z * Math.sin(OBLIQUITY);

  const zEcliptic =
    -vector.y * Math.sin(OBLIQUITY) +
    vector.z * Math.cos(OBLIQUITY);

  return {
    x: vector.x * scale,
    y: zEcliptic * scale,
    z: yEcliptic * scale
  };
}

function calculate(date: Date) {
  const t = new Astronomy.AstroTime(date);

  const earth = toEclipticScene(
    Astronomy.HelioVector(Astronomy.Body.Earth, t),
    AU_SCENE
  );

  const moonGeoRaw = v(
    Astronomy.GeoVector(Astronomy.Body.Moon, t, true)
  );

  const moonGeo = toEclipticScene(
    moonGeoRaw,
    AU_SCENE * MOON_BOOST
  );

  const sunGeo = toEclipticScene(
    Astronomy.GeoVector(Astronomy.Body.Sun, t, true)
  );

  const moon = add(earth, moonGeo);
  const phase = Astronomy.MoonPhase(t);

  return {
    earth,
    moon,
    moonGeo: moonGeoRaw,
    phase,
    illumination: (1 - Math.cos(phase * Math.PI / 180)) / 2,
    sunDirection: norm(sunGeo)
  };
}

function MoonSurface() {
  return <SharedMoonSurface />;
}

/** Dotted path of Earth around the Sun. */
function OrbitPath({
  date,
  color
}: {
  date: Date;
  color: string;
}) {
  const points = useMemo(
    () =>
      Array.from({ length: 721 }, (_, i) => {
        const offsetDays = (i / 720 - 0.5) * 365.256;

        const sampleDate = new Date(
          date.getTime() + offsetDays * 86400000
        );

        const position = Astronomy.HelioVector(
          Astronomy.Body.Earth,
          new Astronomy.AstroTime(sampleDate)
        );

        const scenePosition = toEclipticScene(
          position,
          AU_SCENE
        );

        return [
          scenePosition.x,
          scenePosition.y,
          scenePosition.z
        ] as [number, number, number];
      }),
    [date.getFullYear()]
  );

  return (
    <Line
      points={points}
      color={color}
      transparent
      opacity={0.8}
      lineWidth={1.5}
      dashed
      dashSize={0.09}
      gapSize={0.07}
      dashScale={1}
    />
  );
}

/** Dotted Moon orbit around the Earth. */
function MoonOrbitPath({ earth }: { earth: Vec }) {
  const points = useMemo(
    () =>
      Array.from({ length: 361 }, (_, i) => {
        const angle = (i / 360) * Math.PI * 2;

        // Visually exaggerated Moon orbit to remain readable.
        const radius = 1.42;
        const inclination = THREE.MathUtils.degToRad(5.1);

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const y = z * Math.sin(inclination);
        const adjustedZ = z * Math.cos(inclination);

        return [
          earth.x + x,
          earth.y + y,
          earth.z + adjustedZ
        ] as [number, number, number];
      }),
    [earth.x, earth.y, earth.z]
  );

  return (
    <Line
      points={points}
      color="#a9c8ef"
      transparent
      opacity={0.9}
      lineWidth={1.5}
      dashed
      dashSize={0.045}
      gapSize={0.045}
      dashScale={1}
    />
  );
}

function Scene({
  date,
  mode,
  place,
  resetKey
}: {
  date: Date;
  mode: string;
  place: Place;
  resetKey: number;
}) {
  const sky = useMemo(
    () => calculate(date),
    [date.getTime()]
  );

  const earthRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);

  const previousMoon = useRef(
    new THREE.Vector3(sky.moon.x, sky.moon.y, sky.moon.z)
  );

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const camera = controls.object as THREE.PerspectiveCamera;

    if (mode === 'moon') {
      camera.up.set(0, 1, 0);

      const target = new THREE.Vector3(
        sky.moon.x,
        sky.moon.y,
        sky.moon.z
      );

      controls.target.copy(target);

      camera.position
        .copy(target)
        .add(new THREE.Vector3(0, 0.32, 0.9));
    } else {
      camera.up.set(0, 0, -1);
      controls.target.set(0, 0, 0);
      camera.position.set(0, 14, 0.01);
    }

    previousMoon.current.set(
      sky.moon.x,
      sky.moon.y,
      sky.moon.z
    );

    controls.update();
  }, [mode, resetKey]);

  useFrame(() => {
    if (mode === 'moon' && controlsRef.current) {
      const nextMoon = new THREE.Vector3(
        sky.moon.x,
        sky.moon.y,
        sky.moon.z
      );

      const shift = nextMoon
        .clone()
        .sub(previousMoon.current);

      controlsRef.current.target.add(shift);
      controlsRef.current.object.position.add(shift);

      previousMoon.current.copy(nextMoon);
      controlsRef.current.update();
    }

    const sidereal = Astronomy.SiderealTime(
      new Astronomy.AstroTime(date)
    );

    if (earthRef.current) {
      earthRef.current.rotation.y =
        -(sidereal * Math.PI / 12);
    }

    if (moonRef.current) {
      moonRef.current.rotation.y =
        (date.getTime() / 86400000) *
        (2 * Math.PI / 27.321661);
    }
  });

  const e = sky.earth;
  const m = sky.moon;
  const s = sky.sunDirection;

  const lat = place.lat * Math.PI / 180;
  const lon = place.lon * Math.PI / 180;

  const marker: [number, number, number] = [
    Math.cos(lat) * Math.sin(lon) * 0.326,
    Math.sin(lat) * 0.326,
    Math.cos(lat) * Math.cos(lon) * 0.326
  ];

  return (
    <>
      <color attach="background" args={['#080b16']} />
      <ambientLight intensity={0.18} />

      <directionalLight
        position={[s.x * 100, s.y * 100, s.z * 100]}
        intensity={2.8}
      />

      <Stars
        radius={150}
        depth={65}
        count={3500}
        factor={3}
        saturation={0.15}
        fade
        speed={0.2}
      />

      {/* Sun */}
      <mesh>
        <sphereGeometry args={[0.7, 48, 32]} />
        <meshBasicMaterial color="#ffd27a" />
      </mesh>

      {/* Earth solar orbit */}
      <OrbitPath date={date} color="#e6bd78" />

      {/* Moon orbit around Earth */}
      <MoonOrbitPath earth={e} />

      {/* Earth-to-Moon connecting line */}
      <Line
        points={[
          [e.x, e.y, e.z],
          [m.x, m.y, m.z]
        ]}
        color="#8198b9"
        transparent
        opacity={0.35}
        lineWidth={1}
      />

      {/* Earth */}
      <group ref={earthRef} position={[e.x, e.y, e.z]}>
        <mesh>
          <sphereGeometry args={[0.32, 128, 96]} />
          <EarthSurface />
        </mesh>

        <mesh scale={1.012}>
          <sphereGeometry args={[0.32, 48, 32]} />
          <meshBasicMaterial
            color="#6eb6ff"
            wireframe
            transparent
            opacity={0.035}
          />
        </mesh>

        <mesh position={marker}>
          <sphereGeometry args={[0.018, 16, 12]} />
          <meshBasicMaterial color="#ffcf70" />
        </mesh>

        <mesh position={marker}>
          <ringGeometry args={[0.025, 0.04, 32]} />
          <meshBasicMaterial
            color="#ffcf70"
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Moon */}
      <group ref={moonRef} position={[m.x, m.y, m.z]}>
        <mesh>
          <sphereGeometry args={[0.105, 96, 64]} />
          <MoonSurface />
        </mesh>
      </group>

      <Html position={[0, 0.95, 0]} center>
        <span className="space-label sun-label">SUN</span>
      </Html>

      <Html position={[e.x, e.y + 0.52, e.z]} center>
        <span className="space-label">
          {place.name.toUpperCase()}
        </span>
      </Html>

      <Html position={[m.x, m.y + 0.24, m.z]} center>
        <span className="space-label">MOON</span>
      </Html>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.08}
        minDistance={mode === 'moon' ? 0.15 : 1.5}
        maxDistance={mode === 'moon' ? 8 : 30}
      />
    </>
  );
}

const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function phaseName(angle: number) {
  const p = (angle % 360 + 360) % 360;

  if (p < 22.5 || p >= 337.5) return 'New Moon';
  if (p < 67.5) return 'Waxing Crescent';
  if (p < 112.5) return 'First Quarter';
  if (p < 157.5) return 'Waxing Gibbous';
  if (p < 202.5) return 'Full Moon';
  if (p < 247.5) return 'Waning Gibbous';
  if (p < 292.5) return 'Last Quarter';

  return 'Waning Crescent';
}

function phaseInfo(date: Date) {
  const angle = Astronomy.MoonPhase(
    new Astronomy.AstroTime(date)
  );

  return {
    angle,
    name: phaseName(angle),
    illumination:
      (1 - Math.cos(angle * Math.PI / 180)) / 2
  };
}

function riseSet(date: Date, place: Place) {
  const observer = new Astronomy.Observer(
    place.lat,
    place.lon,
    0
  );

  const start = new Astronomy.AstroTime(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0
    )
  );

  const rise = Astronomy.SearchRiseSet(
    Astronomy.Body.Moon,
    observer,
    +1,
    start,
    2
  );

  const set = Astronomy.SearchRiseSet(
    Astronomy.Body.Moon,
    observer,
    -1,
    start,
    2
  );

  return {
    rise: rise ? rise.date : null,
    set: set ? set.date : null
  };
}

function skyPosition(date: Date, place: Place) {
  const observer = new Astronomy.Observer(
    place.lat,
    place.lon,
    0
  );

  const time = new Astronomy.AstroTime(date);

  const eq = Astronomy.Equator(
    Astronomy.Body.Moon,
    time,
    observer,
    true,
    true
  );

  const hor = Astronomy.Horizon(
    time,
    observer,
    eq.ra,
    eq.dec,
    'normal'
  );

  return {
    altitude: hor.altitude,
    azimuth: hor.azimuth
  };
}

function timeLabel(d: Date | null) {
  return d
    ? d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'No event';
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const count = new Date(year, month + 1, 0).getDate();

  return [
    ...Array(start).fill(null),
    ...Array.from(
      { length: count },
      (_, i) => new Date(year, month, i + 1)
    )
  ];
}

export default function App() {
  const [date, setDate] = useState(() => new Date());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState('system');
  const [viewResetKey, setViewResetKey] = useState(0);

  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(date.getFullYear(), date.getMonth(), 1)
  );

  const [selectedDay, setSelectedDay] = useState(
    () => new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )
  );

  const [observerTime, setObserverTime] = useState(
    () => new Date()
  );

  useEffect(() => {
    if (!playing) return;

    let frameId = 0;
    let previousFrame = 0;

    const animate = (timestamp: number) => {
      if (previousFrame === 0) {
        previousFrame = timestamp;
      }

      const elapsedSeconds = Math.min(
        (timestamp - previousFrame) / 1000,
        0.25
      );

      previousFrame = timestamp;

      setDate(current =>
        new Date(
          current.getTime() +
          elapsedSeconds * 60000 * speed
        )
      );

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [playing, speed]);

  useEffect(() => {
    setSelectedDay(current => {
      const next = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

      return dateKey(current) === dateKey(next)
        ? current
        : next;
    });
  }, [date]);

  const sky = useMemo(
    () => calculate(date),
    [date.getTime()]
  );

  const distance = mag(sky.moonGeo) * AU_KM;

  const events = useMemo(
    () => riseSet(selectedDay, place),
    [selectedDay.getTime(), place.lat, place.lon]
  );

  const position = useMemo(
    () => skyPosition(observerTime, place),
    [observerTime.getTime(), place.lat, place.lon]
  );

  const cells = useMemo(
    () => monthCells(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth()
    ),
    [calendarMonth.getFullYear(), calendarMonth.getMonth()]
  );

  const searchCities = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setLocationMessage('');

    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`
      );

      if (!response.ok) {
        throw new Error('City search unavailable');
      }

      const data = await response.json();

      const found: Place[] = (
        data.results || []
      ).map((x: any) => ({
        name: x.name,
        country: x.country,
        lat: x.latitude,
        lon: x.longitude,
        timezone: x.timezone
      }));

      setResults(found);

      if (!found.length) {
        setLocationMessage(
          'No matching cities found. Try a nearby larger city.'
        );
      }
    } catch {
      setLocationMessage(
        'Could not search cities right now. Check your connection and try again.'
      );
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(
        'This browser does not support location access.'
      );
      return;
    }

    setLocationMessage(
      'Waiting for browser location permission…'
    );

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;

        setPlace({
          name: 'My location',
          lat: latitude,
          lon: longitude
        });

        setLocationMessage(
          `Location selected · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        );

        setResults([]);
      },
      err => {
        setLocationMessage(
          err.code === 1
            ? 'Location permission was denied. You can choose a city instead.'
            : 'Could not determine your location. Try city search.'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000
      }
    );
  };

  const choosePlace = (p: Place) => {
    setPlace(p);
    setResults([]);

    setQuery(
      `${p.name}${p.country ? `, ${p.country}` : ''}`
    );

    setLocationMessage(
      `Observing from ${p.name}${p.country ? `, ${p.country}` : ''}`
    );
  };

  const chooseCalendarDate = (d: Date) => {
    setSelectedDay(d);

    setDate(
      new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        12,
        0
      )
    );
  };

  const selectedPhase = phaseInfo(selectedDay);
  const livePhase = phaseInfo(observerTime);

  const moveMonth = (delta: number) => {
    setCalendarMonth(
      d => new Date(
        d.getFullYear(),
        d.getMonth() + delta,
        1
      )
    );
  };

  const resetView = () => {
    setViewResetKey(key => key + 1);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◉</span>

          <div>
            <div className="brand-name">ORRERY</div>
            <div className="brand-sub">
              A LIVING MODEL OF THE SKY
            </div>
          </div>
        </div>

        <div className="live-indicator">
          <i /> EPHEMERIS ACTIVE
        </div>
      </header>

      <section className="intro">
        <div className="eyebrow">
          THE CELESTIAL MECHANICS STUDIO
        </div>

        <h1>
          Time is another
          <br />
          <em>dimension of space.</em>
        </h1>

        <p>
          Explore the Sun, Earth and Moon — from any date,
          beneath any sky.
        </p>
      </section>

      <nav className="main-tabs">
        {([
          ['system', 'SYSTEM'],
          ['earth', 'EARTH'],
          ['moon', 'MOON'],
          ['city', 'CITY OBSERVATORY']
        ] as const).map(([val, label]) => (
          <button
            key={val}
            className={mode === val ? 'active' : ''}
            onClick={() => setMode(val)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="viewport">
        <div className="viewport-head">
          <span>01 / CELESTIAL VIEW</span>

          <span>
            {mode === 'city'
              ? 'GROUND-LEVEL · CITY SKY'
              : mode === 'earth'
                ? 'EARTH EXPLORER · GROUND / ORBIT / SPACE'
                : 'HELIOCENTRIC · 3D'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '8px 12px'
          }}
        >
          <button
            type="button"
            onClick={resetView}
            style={{
              padding: '8px 14px',
              border: '1px solid rgba(160,180,220,0.35)',
              borderRadius: '6px',
              background: 'rgba(12,18,32,0.88)',
              color: '#dce7ff',
              fontSize: '11px',
              letterSpacing: '1px',
              cursor: 'pointer'
            }}
          >
            ↺ RESET VIEW
          </button>
        </div>

        {mode === 'city' ? (
          <CityView
            date={observerTime}
            place={place}
            resetKey={viewResetKey}
          />
        ) : mode === 'earth' ? (
          <EarthExplorer
            date={date}
            place={place}
            resetKey={viewResetKey}
          />
        ) : (
          <Canvas
            camera={{
              position: [0, 14, 0.01],
              fov: 42,
              up: [0, 0, -1]
            }}
          >
            <Scene
              date={date}
              mode={mode}
              place={place}
              resetKey={viewResetKey}
            />
          </Canvas>
        )}

        <div className="canvas-hint">
          {mode === 'city'
            ? 'DRAG TO LOOK AROUND · OPEN SKY CAMERA'
            : mode === 'earth'
              ? 'GROUND POV · ORBIT POV · SPACE EXPLORATION'
              : 'DRAG TO ORBIT · SCROLL TO ZOOM'}
        </div>
      </section>

      <section className="control-panel">
        <div className="panel-title">
          02 / TIME MACHINE
          <span>
            LOCAL TIME · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
        </div>

        <div className="time-row">
          <input
            aria-label="Date and time"
            type="datetime-local"
            value={localInput(date)}
            onChange={e => {
              if (e.target.value) {
                setDate(new Date(e.target.value));
              }
            }}
          />

          <button
            className="now-btn"
            onClick={() => setDate(new Date())}
          >
            NOW
          </button>
        </div>

        <div className="transport">
          <button
            onClick={() =>
              setDate(d =>
                new Date(d.getTime() - 86400000)
              )
            }
          >
            − 1 DAY
          </button>

          <button
            className="play-btn"
            onClick={() => setPlaying(x => !x)}
          >
            {playing ? 'Ⅱ PAUSE' : '▶ PLAY TIME'}
          </button>

          <button
            onClick={() =>
              setDate(d =>
                new Date(d.getTime() + 86400000)
              )
            }
          >
            + 1 DAY
          </button>

          <select
            aria-label="Time speed"
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
          >
            <option value={1}>1 min/s</option>
            <option value={60}>1 hour/s</option>
            <option value={1440}>1 day/s</option>
            <option value={10080}>1 week/s</option>
            <option value={43200}>30 days/s</option>
            <option value={144000}>100 days/s</option>
          </select>
        </div>
      </section>

      <section className="location-panel">
        <div className="panel-title">
          03 / OBSERVING LOCATION
          <span>WORLDWIDE CITY SEARCH</span>
        </div>

        <div className="location-current">
          <strong>
            {place.name}
            {place.country ? `, ${place.country}` : ''}
          </strong>

          <span>
            {place.lat.toFixed(4)}°, {place.lon.toFixed(4)}°
          </span>
        </div>

        <div className="location-actions">
          <input
            value={query}
            placeholder="Search any city worldwide…"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                void searchCities();
              }
            }}
          />

          <button
            onClick={() => void searchCities()}
            disabled={searching}
          >
            {searching ? 'SEARCHING…' : 'SEARCH CITY'}
          </button>

          <button
            className="geo-btn"
            onClick={useMyLocation}
          >
            ◎ USE MY LOCATION
          </button>
        </div>

        {locationMessage && (
          <p className="location-message">
            {locationMessage}
          </p>
        )}

        {results.length > 0 && (
          <div className="city-results">
            {results.map((p, i) => (
              <button
                key={`${p.name}-${p.lat}-${i}`}
                onClick={() => choosePlace(p)}
              >
                <strong>{p.name}</strong>

                <span>
                  {p.country || 'Location'} ·
                  {' '}{p.lat.toFixed(2)}, {p.lon.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="small-note">
          Your browser asks permission before sharing your
          location. ORRERY uses it only in this page to
          calculate your local sky.
        </p>
      </section>

      <section className="data-grid">
        <article className="data-card phase-card">
          <div className="card-kicker">
            04 / LUNAR PHASE
          </div>

          <div className="phase-row">
            <div className="moon-glyph">◐</div>

            <div>
              <h2>{phaseName(sky.phase)}</h2>

              <p>
                {(sky.illumination * 100).toFixed(1)}%
                illuminated · {sky.phase.toFixed(1)}°
                phase angle
              </p>
            </div>
          </div>

          <div className="meter">
            <span
              style={{
                width: `${sky.illumination * 100}%`
              }}
            />
          </div>
        </article>

        <article className="data-card">
          <div className="card-kicker">
            05 / EARTH–MOON
          </div>

          <h2>
            {distance.toLocaleString('en-US', {
              maximumFractionDigits: 0
            })} km
          </h2>

          <p>Geocentric distance</p>
        </article>

        <article className="data-card">
          <div className="card-kicker">
            06 / SIMULATION DATE
          </div>

          <h2>
            {date.toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}
          </h2>

          <p>
            {date.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })} · local
          </p>
        </article>
      </section>

      <section className="calendar-panel">
        <div className="panel-title">
          07 / LUNAR CALENDAR
          <span>SELECT A DAY TO EXPLORE ITS MOON</span>
        </div>

        <div className="calendar-heading">
          <button onClick={() => moveMonth(-1)}>←</button>

          <h2>
            {calendarMonth.toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric'
            })}
          </h2>

          <button onClick={() => moveMonth(1)}>→</button>
        </div>

        <div className="calendar-grid">
          {[
            'SUN', 'MON', 'TUE', 'WED',
            'THU', 'FRI', 'SAT'
          ].map(x => (
            <div className="weekday" key={x}>
              {x}
            </div>
          ))}

          {cells.map((d, i) => {
            if (!d) {
              return (
                <div
                  className="calendar-empty"
                  key={`e${i}`}
                />
              );
            }

            const info = phaseInfo(d);
            const chosen = dateKey(d) === dateKey(selectedDay);
            const today = dateKey(d) === dateKey(new Date());

            return (
              <button
                key={dateKey(d)}
                className={`calendar-day ${chosen ? 'chosen' : ''} ${today ? 'today' : ''}`}
                onClick={() => chooseCalendarDate(d)}
              >
                <span>{d.getDate()}</span>

                <i>
                  {info.illumination > 0.94
                    ? '●'
                    : info.illumination < 0.06
                      ? '○'
                      : info.angle < 180
                        ? '◔'
                        : '◕'}
                </i>

                <small>
                  {Math.round(info.illumination * 100)}%
                </small>
              </button>
            );
          })}
        </div>

        <div className="calendar-detail">
          <strong>
            {selectedDay.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </strong>

          <span>
            {selectedPhase.name} ·
            {' '}{(selectedPhase.illumination * 100).toFixed(1)}%
            illuminated
          </span>
        </div>
      </section>

      <section className="city-panel">
        <div className="panel-title">
          08 / CITY OBSERVATORY
          <span>{place.name.toUpperCase()}</span>
        </div>

        <div className="rise-set-grid">
          <article>
            <span>MOONRISE</span>
            <strong>{timeLabel(events.rise)}</strong>
          </article>

          <article>
            <span>MOONSET</span>
            <strong>{timeLabel(events.set)}</strong>
          </article>

          <article>
            <span>ILLUMINATION</span>
            <strong>
              {(livePhase.illumination * 100).toFixed(1)}%
            </strong>
          </article>
        </div>

        <div className="position-grid">
          <article>
            <span>ALTITUDE</span>
            <strong>{position.altitude.toFixed(1)}°</strong>
          </article>

          <article>
            <span>AZIMUTH</span>
            <strong>{position.azimuth.toFixed(1)}°</strong>

            <small>
              {position.azimuth < 22.5 ||
              position.azimuth >= 337.5
                ? 'NORTH'
                : position.azimuth < 67.5
                  ? 'NORTH-EAST'
                  : position.azimuth < 112.5
                    ? 'EAST'
                    : position.azimuth < 157.5
                      ? 'SOUTH-EAST'
                      : position.azimuth < 202.5
                        ? 'SOUTH'
                        : position.azimuth < 247.5
                          ? 'SOUTH-WEST'
                          : position.azimuth < 292.5
                            ? 'WEST'
                            : 'NORTH-WEST'}
            </small>
          </article>

          <article>
            <span>PHASE</span>
            <strong>{livePhase.name}</strong>
          </article>
        </div>

        <div className="observer-time">
          <label>Inspect local sky at</label>

          <input
            type="datetime-local"
            value={localInput(observerTime)}
            onChange={e => {
              if (e.target.value) {
                setObserverTime(new Date(e.target.value));
              }
            }}
          />

          <button onClick={() => setObserverTime(new Date())}>
            NOW
          </button>
        </div>

        <p className="small-note">
          Rise and set are calculated for the selected
          date and observing coordinates. Times are shown
          in your device's local timezone. Near the poles
          or during unusual lunar cycles, an event may not
          occur that day.
        </p>
      </section>

      <footer>
        <span>ORRERY / FIELD NOTES 002</span>

        <span>
          Ephemerides: Astronomy Engine · City search:
          Open-Meteo Geocoding · Body sizes and Moon
          distance visually exaggerated
        </span>
      </footer>
    </main>
  );
}
