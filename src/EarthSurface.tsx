
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

function makeEarthTexture() {
  const width = 2048;
  const height = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d')!;

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#102d50');
  ocean.addColorStop(0.5, '#12517b');
  ocean.addColorStop(1, '#0b2949');

  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  let seed = 1984;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Subtle ocean currents and depth variation.
  for (let i = 0; i < 12000; i++) {
    const x = random() * width;
    const y = random() * height;
    ctx.fillStyle = random() > 0.5
      ? 'rgba(95,160,190,0.045)'
      : 'rgba(0,10,30,0.055)';
    ctx.fillRect(x, y, 2 + random() * 9, 1 + random() * 2);
  }

  // Simplified equirectangular continent outlines.
  // Coordinates are normalized to the texture dimensions.
  const continents: number[][][] = [
    [
      [0.055,0.19],[0.09,0.12],[0.14,0.10],[0.18,0.15],
      [0.20,0.22],[0.18,0.29],[0.16,0.34],[0.17,0.40],
      [0.14,0.46],[0.12,0.43],[0.10,0.36],[0.075,0.31],
      [0.05,0.26]
    ],
    [
      [0.19,0.47],[0.23,0.48],[0.25,0.54],[0.24,0.62],
      [0.22,0.70],[0.20,0.78],[0.18,0.73],[0.17,0.64],
      [0.16,0.56]
    ],
    [
      [0.40,0.18],[0.45,0.13],[0.51,0.14],[0.55,0.19],
      [0.60,0.20],[0.64,0.25],[0.62,0.31],[0.58,0.32],
      [0.56,0.38],[0.51,0.39],[0.48,0.34],[0.44,0.33],
      [0.41,0.27]
    ],
    [
      [0.48,0.39],[0.54,0.38],[0.57,0.44],[0.56,0.53],
      [0.53,0.62],[0.50,0.69],[0.47,0.64],[0.46,0.56],
      [0.45,0.47]
    ],
    [
      [0.59,0.18],[0.65,0.13],[0.73,0.15],[0.80,0.20],
      [0.84,0.26],[0.82,0.33],[0.77,0.36],[0.74,0.33],
      [0.70,0.39],[0.66,0.35],[0.63,0.29],[0.60,0.27]
    ],
    [
      [0.72,0.42],[0.76,0.40],[0.80,0.44],[0.82,0.50],
      [0.79,0.56],[0.76,0.59],[0.73,0.54]
    ],
    [
      [0.85,0.63],[0.89,0.61],[0.92,0.66],[0.91,0.72],
      [0.87,0.74],[0.84,0.69]
    ],
    [
      [0.36,0.08],[0.41,0.06],[0.44,0.09],[0.41,0.12]
    ]
  ];

  continents.forEach((points, index) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const px = x * width;
      const py = y * height;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();

    const land = ctx.createLinearGradient(0, 100, 0, height * 0.8);
    land.addColorStop(0, '#b9b68b');
    land.addColorStop(0.45, '#77966c');
    land.addColorStop(1, '#a59b75');

    ctx.fillStyle = land;
    ctx.fill();

    ctx.strokeStyle = 'rgba(205,211,165,0.45)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Terrain speckles within the broad land regions.
    const bounds = points.reduce(
      (b, p) => ({
        minX: Math.min(b.minX, p[0]),
        maxX: Math.max(b.maxX, p[0]),
        minY: Math.min(b.minY, p[1]),
        maxY: Math.max(b.maxY, p[1])
      }),
      {
        minX: 1, maxX: 0, minY: 1, maxY: 0
      }
    );

    for (let j = 0; j < 180; j++) {
      const x = (bounds.minX + random() * (bounds.maxX - bounds.minX)) * width;
      const y = (bounds.minY + random() * (bounds.maxY - bounds.minY)) * height;
      ctx.fillStyle = random() > 0.5
        ? 'rgba(232,218,166,0.16)'
        : 'rgba(35,72,52,0.13)';
      ctx.beginPath();
      ctx.arc(x, y, 2 + random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Polar ice caps.
  ctx.fillStyle = 'rgba(225,237,239,0.88)';
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.025, width * 0.48, height * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.975, width * 0.48, height * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft cloud streaks.
  for (let i = 0; i < 170; i++) {
    const x = random() * width;
    const y = random() * height;
    const length = 12 + random() * 95;

    ctx.strokeStyle = `rgba(235,242,245,${0.035 + random() * 0.10})`;
    ctx.lineWidth = 2 + random() * 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + length * 0.25, y - 5,
      x + length * 0.7, y + 5,
      x + length, y
    );
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}

export default function EarthSurface() {
  const texture = useMemo(() => makeEarthTexture(), []);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <meshStandardMaterial
      map={texture}
      roughness={0.94}
      metalness={0}
    />
  );
}
