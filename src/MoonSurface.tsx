
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

function createLunarTextures() {
  const width = 2048;
  const height = 1024;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;

  const color = colorCanvas.getContext('2d')!;
  const bump = bumpCanvas.getContext('2d')!;

  // Lunar regolith base.
  color.fillStyle = '#85847f';
  color.fillRect(0, 0, width, height);

  bump.fillStyle = '#858585';
  bump.fillRect(0, 0, width, height);

  // Deterministic random numbers keep the texture stable.
  let seed = 4720;

  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Broad lunar maria and darker volcanic plains.
  for (let i = 0; i < 30; i++) {
    const x = random() * width;
    const y = random() * height;
    const rx = 35 + random() * 145;
    const ry = 18 + random() * 75;

    const gradient = color.createRadialGradient(
      x, y, 0, x, y, rx
    );

    gradient.addColorStop(0, 'rgba(45,44,43,0.42)');
    gradient.addColorStop(0.65, 'rgba(66,65,62,0.22)');
    gradient.addColorStop(1, 'rgba(66,65,62,0)');

    color.save();
    color.translate(x, y);
    color.scale(1, ry / rx);
    color.fillStyle = gradient;
    color.beginPath();
    color.arc(0, 0, rx, 0, Math.PI * 2);
    color.fill();
    color.restore();

    bump.save();
    bump.translate(x, y);
    bump.scale(1, ry / rx);
    const bg = bump.createRadialGradient(0, 0, 0, 0, 0, rx);
    bg.addColorStop(0, 'rgba(35,35,35,0.35)');
    bg.addColorStop(1, 'rgba(35,35,35,0)');
    bump.fillStyle = bg;
    bump.beginPath();
    bump.arc(0, 0, rx, 0, Math.PI * 2);
    bump.fill();
    bump.restore();
  }

  // Craters of different sizes.
  for (let i = 0; i < 1250; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = 2 + Math.pow(random(), 2.5) * 34;
    const depth = 0.12 + random() * 0.32;

    const crater = color.createRadialGradient(
      x - radius * 0.25,
      y - radius * 0.28,
      radius * 0.12,
      x,
      y,
      radius
    );

    crater.addColorStop(0, 'rgba(45,44,42,0.12)');
    crater.addColorStop(0.58, 'rgba(55,54,52,0.18)');
    crater.addColorStop(0.78, `rgba(30,29,28,${depth})`);
    crater.addColorStop(0.91, 'rgba(205,201,190,0.48)');
    crater.addColorStop(1, 'rgba(75,73,70,0.08)');

    color.fillStyle = crater;
    color.beginPath();
    color.arc(x, y, radius, 0, Math.PI * 2);
    color.fill();

    const relief = bump.createRadialGradient(
      x - radius * 0.22,
      y - radius * 0.25,
      radius * 0.12,
      x,
      y,
      radius
    );

    relief.addColorStop(0, '#858585');
    relief.addColorStop(0.62, '#777777');
    relief.addColorStop(0.78, '#484848');
    relief.addColorStop(0.92, '#c4c4c4');
    relief.addColorStop(1, '#858585');

    bump.fillStyle = relief;
    bump.beginPath();
    bump.arc(x, y, radius, 0, Math.PI * 2);
    bump.fill();
  }

  // Fine surface grain.
  for (let i = 0; i < 18000; i++) {
    const x = random() * width;
    const y = random() * height;
    const light = random() > 0.5;

    color.fillStyle = light
      ? 'rgba(225,220,205,0.10)'
      : 'rgba(20,20,20,0.10)';

    color.fillRect(x, y, 1.5, 1.5);

    bump.fillStyle = light
      ? 'rgba(220,220,220,0.12)'
      : 'rgba(25,25,25,0.12)';

    bump.fillRect(x, y, 1.5, 1.5);
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.ClampToEdgeWrapping;
  colorTexture.anisotropy = 8;

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
  bumpTexture.anisotropy = 8;

  return { colorTexture, bumpTexture };
}

export default function MoonSurface() {
  const textures = useMemo(() => createLunarTextures(), []);

  useEffect(() => {
    return () => {
      textures.colorTexture.dispose();
      textures.bumpTexture.dispose();
    };
  }, [textures]);

  return (
    <meshStandardMaterial
      map={textures.colorTexture}
      bumpMap={textures.bumpTexture}
      bumpScale={0.035}
      roughness={1}
      metalness={0}
      color="#ffffff"
    />
  );
}
