
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';

type Place = {
  name: string;
  lat: number;
  lon: number;
  timezone?: string;
};

type Props = {
  date: Date;
  place: Place;
  resetKey: number;
};

function horizontal(date: Date, place: Place, body: Astronomy.Body) {
  const observer = new Astronomy.Observer(place.lat, place.lon, 0);
  const time = new Astronomy.AstroTime(date);
  const eq = Astronomy.Equator(body, time, observer, true, true);
  const h = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');
  const az = h.azimuth * Math.PI / 180;
  const alt = h.altitude * Math.PI / 180;

  return {
    altitude: h.altitude,
    azimuth: h.azimuth,
    direction: new THREE.Vector3(
      Math.sin(az) * Math.cos(alt),
      Math.sin(alt),
      -Math.cos(az) * Math.cos(alt)
    ).normalize()
  };
}

function Skyline() {
  const buildings = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => {
      const angle = (i / 48) * Math.PI * 2;
      const height = 1.2 + ((i * 17) % 11) * 0.24;
      const width = 0.55 + ((i * 7) % 5) * 0.12;
      const depth = 0.55 + ((i * 13) % 4) * 0.12;
      const radius = 9 + (i % 3) * 0.7;

      return {
        key: i,
        position: [
          Math.sin(angle) * radius,
          height / 2,
          -Math.cos(angle) * radius
        ] as [number, number, number],
        size: [width, height, depth] as [number, number, number],
        color: i % 4 === 0 ? '#34394b' : '#20283a',
        windows: i % 3 === 0
      };
    });
  }, []);

  return (
    <group>
      {buildings.map(b => (
        <group key={b.key} position={b.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.color} roughness={0.92} />
          </mesh>
          {b.windows && (
            <mesh position={[0, 0, b.size[2] / 2 + 0.006]}>
              <planeGeometry args={[b.size[0] * 0.72, b.size[1] * 0.8]} />
              <meshBasicMaterial color="#c69c59" transparent opacity={0.28} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function CitySky({ date, place, resetKey }: Props) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (resetKey > 0) {
      controlsRef.current?.reset();
    }
  }, [resetKey]);

  const moon = useMemo(
    () => horizontal(date, place, Astronomy.Body.Moon),
    [date.getTime(), place.lat, place.lon]
  );

  const sun = useMemo(
    () => horizontal(date, place, Astronomy.Body.Sun),
    [date.getTime(), place.lat, place.lon]
  );

  const phase = Astronomy.MoonPhase(new Astronomy.AstroTime(date));
  const illumination = (1 - Math.cos(phase * Math.PI / 180)) / 2;

  const moonPosition = moon.direction.clone().multiplyScalar(28);
  const sunPosition = sun.direction.clone().multiplyScalar(45);

  return (
    <>
      <color attach="background" args={['#080e1c']} />
      <fog attach="fog" args={['#101a2a', 24, 65]} />
      <ambientLight intensity={0.16} />

      <directionalLight
        position={[sunPosition.x, sunPosition.y, sunPosition.z]}
        intensity={sun.altitude > -6 ? 1.8 : 0.08}
      />

      {moon.altitude > -2 && illumination > 0.02 && (
        <directionalLight
          position={[
            moon.direction.x * 35,
            moon.direction.y * 35,
            moon.direction.z * 35
          ]}
          intensity={0.12 + illumination * 0.42}
          color="#c5d5ff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={70}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-bias={-0.0003}
        />
      )}

      <Stars
        radius={100}
        depth={55}
        count={2600}
        factor={2.5}
        saturation={0.15}
        fade
        speed={0.1}
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.08, 0]}
        receiveShadow
      >
        <circleGeometry args={[45, 96]} />
        <meshStandardMaterial color="#111a23" roughness={1} />
      </mesh>

      <Skyline />

      {moon.altitude > -5 && (
        <group position={[
          moonPosition.x,
          moonPosition.y,
          moonPosition.z
        ]}>
          <mesh>
            <sphereGeometry args={[1.15, 96, 64]} />
            <meshStandardMaterial color="#b9b9b4" roughness={1} />
          </mesh>
          <Html position={[0, 1.65, 0]} center>
            <div className="city-moon-label">
              MOON · {Math.round(illumination * 100)}% LIT
            </div>
          </Html>
        </group>
      )}

      {sun.altitude > -3 && (
        <mesh position={[
          sun.direction.x * 32,
          sun.direction.y * 32,
          sun.direction.z * 32
        ]}>
          <sphereGeometry args={[0.7, 32, 24]} />
          <meshBasicMaterial color="#e9b96e" />
        </mesh>
      )}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.08}
        target={[0, 2, 0]}
        minDistance={4}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

function normalizeAngle(angle: number) {
  return ((angle + 540) % 360) - 180;
}

export default function CityView({ date, place, resetKey }: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [heading, setHeading] = useState<number | null>(null);
  const [pitch, setPitch] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const moon = useMemo(
    () => horizontal(date, place, Astronomy.Body.Moon),
    [date.getTime(), place.lat, place.lon]
  );

  const delta = heading === null
    ? null
    : normalizeAngle(moon.azimuth - heading);

  const markerX = delta === null
    ? 50
    : Math.max(5, Math.min(95, 50 + delta * 0.48));

  const markerY = Math.max(
    10,
    Math.min(82, 50 - (moon.altitude - pitch) * 0.65)
  );

  useEffect(() => {
    if (!cameraOpen) return;

    let active = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });

        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError(
          'Camera access failed. Allow camera permission and use HTTPS.'
        );
      }
    };

    void startCamera();

    const onOrientation = (event: DeviceOrientationEvent) => {
      const e = event as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
      };

      const compass = e.webkitCompassHeading;
      const calculatedHeading = typeof compass === 'number'
        ? compass
        : typeof e.alpha === 'number'
          ? (360 - e.alpha) % 360
          : null;

      if (calculatedHeading !== null) {
        setHeading(calculatedHeading);
      }

      if (typeof e.beta === 'number') {
        setPitch(e.beta - 90);
      }
    };

    window.addEventListener('deviceorientation', onOrientation, true);

    return () => {
      active = false;
      window.removeEventListener('deviceorientation', onOrientation, true);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  const openCamera = async () => {
    setCameraError('');

    const DeviceOrientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<string>;
    };

    if (typeof DeviceOrientation.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientation.requestPermission();
        if (permission !== 'granted') {
          setCameraError(
            'Motion permission was not granted. The camera can still open, but pointing guidance may be limited.'
          );
        }
      } catch {
        setCameraError('Could not request motion sensor permission.');
      }
    }

    setCameraOpen(true);
  };

  return (
    <div className="city-view">
      {!cameraOpen ? (
        <>
          <Canvas shadows camera={{ position: [0, 4, 14], fov: 58 }}>
            <CitySky date={date} place={place} resetKey={resetKey} />
          </Canvas>

          <div className="city-view-caption">
            {place.name.toUpperCase()} · LIVE CELESTIAL POSITION
          </div>

          <button className="sky-camera-button" onClick={openCamera}>
            ◎ OPEN SKY CAMERA
          </button>
        </>
      ) : (
        <div className="sky-camera">
          <video
            ref={videoRef}
            className="sky-camera-video"
            autoPlay
            muted
            playsInline
          />

          <div className="sky-camera-top">
            <span>ORRERY / SKY FINDER</span>
            <button onClick={() => setCameraOpen(false)}>CLOSE ×</button>
          </div>

          <div
            className={`sky-moon-marker ${moon.altitude < 0 ? 'below-horizon' : ''}`}
            style={{
              left: `${markerX}%`,
              top: `${markerY}%`
            }}
          >
            <div className="sky-moon-crosshair">
              {moon.altitude < 0 ? '↓' : '☾'}
            </div>
            <span>
              {moon.altitude < 0
                ? 'MOON · BELOW HORIZON'
                : 'MOON TARGET'}
            </span>
          </div>

          {delta !== null && Math.abs(delta) > 35 && (
            <div className="sky-camera-instruction">
              TURN {delta > 0 ? 'RIGHT' : 'LEFT'} TO FIND THE MOON
            </div>
          )}

          <div className="sky-camera-data">
            <span>AZIMUTH {moon.azimuth.toFixed(1)}°</span>
            <span>ALTITUDE {moon.altitude.toFixed(1)}°</span>
            <span>
              {heading === null
                ? 'COMPASS WAITING FOR SENSOR'
                : `HEADING ${heading.toFixed(0)}°`}
            </span>
          </div>

          {cameraError && (
            <div className="sky-camera-error">{cameraError}</div>
          )}

          <div className="sky-camera-note">
            Predicted astronomical target · visible through camera obstructions · sensor accuracy varies by device
          </div>
        </div>
      )}
    </div>
  );
}
