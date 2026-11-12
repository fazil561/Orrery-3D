
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import EarthSurface from './EarthSurface';
import MapGlobe from './MapGlobe';

type Place = {
  name: string;
  country?: string;
  lat: number;
  lon: number;
};

type Props = {
  date: Date;
  place: Place;
  resetKey?: number;
};

type ViewMode = 'ground' | 'orbit' | 'space';

function localDirections(place: Place, azimuth: number, altitude: number) {
  const lat = THREE.MathUtils.degToRad(place.lat);
  const lon = THREE.MathUtils.degToRad(place.lon);
  const az = THREE.MathUtils.degToRad(azimuth);
  const alt = THREE.MathUtils.degToRad(altitude);

  const up = new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon)
  ).normalize();

  const east = new THREE.Vector3(
    Math.cos(lon),
    0,
    -Math.sin(lon)
  ).normalize();

  const north = new THREE.Vector3(
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat),
    -Math.sin(lat) * Math.cos(lon)
  ).normalize();

  const direction = north
    .clone()
    .multiplyScalar(Math.cos(alt) * Math.cos(az))
    .add(east.clone().multiplyScalar(Math.cos(alt) * Math.sin(az)))
    .add(up.clone().multiplyScalar(Math.sin(alt)))
    .normalize();

  return { up, east, north, direction };
}

function getHorizontal(date: Date, place: Place, body: Astronomy.Body) {
  const observer = new Astronomy.Observer(place.lat, place.lon, 0);
  const time = new Astronomy.AstroTime(date);

  const equatorial = Astronomy.Equator(
    body,
    time,
    observer,
    true,
    true
  );

  const horizontal = Astronomy.Horizon(
    time,
    observer,
    equatorial.ra,
    equatorial.dec,
    'normal'
  );

  return {
    altitude: horizontal.altitude,
    azimuth: horizontal.azimuth
  };
}

function EarthScene({
  date,
  place,
  view,
  resetKey
}: {
  date: Date;
  place: Place;
  view: ViewMode;
  resetKey: number;
}) {
  const controlsRef = useRef<any>(null);
  const transitionRef = useRef(false);

  const goalPosition = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3());
  const goalUp = useRef(new THREE.Vector3(0, 1, 0));

  const observer = useMemo(() => {
    const lat = THREE.MathUtils.degToRad(place.lat);
    const lon = THREE.MathUtils.degToRad(place.lon);

    return new THREE.Vector3(
      Math.cos(lat) * Math.sin(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.cos(lon)
    ).normalize();
  }, [place.lat, place.lon]);

  const north = useMemo(() => {
    const lat = THREE.MathUtils.degToRad(place.lat);
    const lon = THREE.MathUtils.degToRad(place.lon);

    return new THREE.Vector3(
      -Math.sin(lat) * Math.sin(lon),
      Math.cos(lat),
      -Math.sin(lat) * Math.cos(lon)
    ).normalize();
  }, [place.lat, place.lon]);

  const moon = useMemo(
    () => getHorizontal(date, place, Astronomy.Body.Moon),
    [date.getTime(), place.lat, place.lon]
  );

  const sun = useMemo(
    () => getHorizontal(date, place, Astronomy.Body.Sun),
    [date.getTime(), place.lat, place.lon]
  );

  const moonDirection = useMemo(
    () => localDirections(place, moon.azimuth, moon.altitude).direction,
    [place.lat, place.lon, moon.azimuth, moon.altitude]
  );

  const sunDirection = useMemo(
    () => localDirections(place, sun.azimuth, sun.altitude).direction,
    [place.lat, place.lon, sun.azimuth, sun.altitude]
  );

  const moonPosition = useMemo(
    () => observer.clone().multiplyScalar(1.01)
      .add(moonDirection.clone().multiplyScalar(3.8)),
    [observer, moonDirection]
  );

  const sunPosition = useMemo(
    () => sunDirection.clone().multiplyScalar(18),
    [sunDirection]
  );

  const phase = Astronomy.MoonPhase(new Astronomy.AstroTime(date));
  const illumination = (1 - Math.cos(phase * Math.PI / 180)) / 2;

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const camera = controls.object as THREE.PerspectiveCamera;

    if (view === 'ground') {
      goalPosition.current.copy(observer).multiplyScalar(1.018);
      goalTarget.current.copy(goalPosition.current).add(north.clone().multiplyScalar(0.8));
      goalUp.current.copy(observer);
    } else if (view === 'orbit') {
      goalPosition.current.copy(observer).multiplyScalar(4.5);
      goalPosition.current.add(new THREE.Vector3(0, 1.0, 0));
      goalTarget.current.set(0, 0, 0);
      goalUp.current.set(0, 1, 0);
    } else {
      goalPosition.current.set(0, 8, 16);
      goalTarget.current.set(0, 0, 0);
      goalUp.current.set(0, 1, 0);
    }

    transitionRef.current = true;
    camera.up.copy(goalUp.current);
  }, [view, resetKey, observer, north]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (transitionRef.current) {
      const camera = controls.object as THREE.PerspectiveCamera;
      const alpha = 1 - Math.exp(-3.2 * Math.min(delta, 0.05));

      camera.position.lerp(goalPosition.current, alpha);
      controls.target.lerp(goalTarget.current, alpha);
      camera.up.lerp(goalUp.current, alpha).normalize();

      if (
        camera.position.distanceTo(goalPosition.current) < 0.025 &&
        controls.target.distanceTo(goalTarget.current) < 0.025
      ) {
        camera.position.copy(goalPosition.current);
        controls.target.copy(goalTarget.current);
        camera.up.copy(goalUp.current);
        transitionRef.current = false;
      }
    }

    controls.update();
  });

  return (
    <>
      <color attach="background" args={['#050914']} />
      <ambientLight intensity={0.35} />

      <directionalLight
        position={sunPosition.toArray()}
        intensity={3.1}
      />

      <Stars
        radius={120}
        depth={70}
        count={4500}
        factor={3}
        saturation={0.12}
        fade
        speed={0.15}
      />

      <mesh>
        <sphereGeometry args={[1, 128, 96]} />
        <EarthSurface />
      </mesh>

      {/* Observing location marker */}
      <mesh position={observer.clone().multiplyScalar(1.009).toArray()}>
        <sphereGeometry args={[0.014, 16, 12]} />
        <meshBasicMaterial color="#ffd27a" />
      </mesh>

      <mesh
        position={observer.clone().multiplyScalar(1.012).toArray()}
        quaternion={new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          observer
        )}
      >
        <ringGeometry args={[0.022, 0.032, 40]} />
        <meshBasicMaterial
          color="#ffd27a"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Moon: topocentric direction calculated for this observer */}
      <group position={moonPosition.toArray()}>
        <mesh>
          <sphereGeometry args={[0.27, 64, 48]} />
          <meshStandardMaterial
            color="#c8c6bd"
            roughness={1}
          />
        </mesh>
        <Html position={[0, 0.38, 0]} center>
          <span className="earth-body-label">
            MOON · {Math.round(illumination * 100)}% LIT
          </span>
        </Html>
      </group>

      {/* Sun: direction and altitude calculated for this observer */}
      <group position={sunPosition.toArray()}>
        <mesh>
          <sphereGeometry args={[0.75, 48, 32]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
        <pointLight intensity={2.5} distance={0} />
        <Html position={[0, 1.0, 0]} center>
          <span className="earth-body-label">SUN</span>
        </Html>
      </group>

      {view === 'ground' && (
        <Html position={observer.clone().multiplyScalar(1.04).toArray()}>
          <span className="earth-location-label">
            {place.name.toUpperCase()}
          </span>
        </Html>
      )}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        enablePan={view !== 'ground'}
        minDistance={view === 'ground' ? 0.008 : 1.1}
        maxDistance={view === 'ground' ? 30 : 45}
      />
    </>
  );
}

export default function EarthExplorer({
  date,
  place,
  resetKey = 0
}: Props) {
  const [view, setView] = useState<ViewMode>('orbit');
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    setView('orbit');
    setShowMap(false);
  }, [resetKey]);

  const setCameraView = (next: ViewMode) => {
    setShowMap(false);
    setView(next);
  };

  return (
    <div className="earth-explorer">
      <Canvas
        camera={{
          position: [0, 4.5, 7],
          fov: 48,
          near: 0.001,
          far: 500
        }}
        gl={{ antialias: true, alpha: false }}
      >
        <EarthScene
          date={date}
          place={place}
          view={view}
          resetKey={resetKey}
        />
      </Canvas>

      <div className="earth-explorer-controls">
        <div className="earth-mode-switch">
          <button
            className={view === 'ground' ? 'active' : ''}
            onClick={() => setCameraView('ground')}
          >
            GROUND POV
          </button>
          <button
            className={view === 'orbit' ? 'active' : ''}
            onClick={() => setCameraView('orbit')}
          >
            ORBIT POV
          </button>
        </div>

        <div className="earth-action-switch">
          <button
            onClick={() => setCameraView('space')}
            className={view === 'space' ? 'active' : ''}
          >
            ↗ TAKE ME TO SPACE
          </button>
          <button
            onClick={() => setShowMap(current => !current)}
            className={showMap ? 'active' : ''}
          >
            {showMap ? 'RETURN TO 3D' : '◎ MAP ATLAS'}
          </button>
        </div>
      </div>

      <div className="earth-explorer-readout">
        <span>{place.name.toUpperCase()}</span>
        <span>
          {date.toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short'
          })}
        </span>
        <span>
          MOON {moonLabel(date, place)}
        </span>
      </div>

      <div className="earth-explorer-hint">
        {showMap
          ? 'INTERACTIVE MAP · DRAG TO ROTATE · SCROLL TO ZOOM'
          : view === 'ground'
            ? 'GROUND OBSERVER · DRAG TO LOOK AROUND'
            : view === 'orbit'
              ? 'ORBITAL OBSERVER · DRAG TO ROTATE · SCROLL TO ZOOM'
              : 'DEEP SPACE · DRAG TO EXPLORE'}
      </div>

      {showMap && (
        <div className="earth-map-overlay">
          <MapGlobe place={place} />
          <button
            className="earth-map-return"
            onClick={() => setShowMap(false)}
          >
            RETURN TO 3D EARTH
          </button>
        </div>
      )}
    </div>
  );
}

function moonLabel(date: Date, place: Place) {
  const observer = new Astronomy.Observer(place.lat, place.lon, 0);
  const time = new Astronomy.AstroTime(date);
  const eq = Astronomy.Equator(
    Astronomy.Body.Moon,
    time,
    observer,
    true,
    true
  );
  const horizontal = Astronomy.Horizon(
    time,
    observer,
    eq.ra,
    eq.dec,
    'normal'
  );

  return `${horizontal.altitude.toFixed(1)}° ALT`;
}
