import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';

type Vec = { x:number; y:number; z:number };
const v = (p:{x:number;y:number;z:number}):Vec => ({x:p.x,y:p.y,z:p.z});
const add = (a:Vec,b:Vec):Vec => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul = (a:Vec,n:number):Vec => ({x:a.x*n,y:a.y*n,z:a.z*n});
const mag = (a:Vec) => Math.hypot(a.x,a.y,a.z)||1;
const norm = (a:Vec) => mul(a,1/mag(a));
const AU_KM=149597870.7, AU_SCENE=5, MOON_BOOST=110;

function calculate(date:Date) {
  const t=new Astronomy.AstroTime(date);
  const earth=mul(v(Astronomy.HelioVector(Astronomy.Body.Earth,t)),AU_SCENE);
  const moonGeo=v(Astronomy.GeoVector(Astronomy.Body.Moon,t,true));
  const sunGeo=v(Astronomy.GeoVector(Astronomy.Body.Sun,t,true));
  const moon=add(earth,mul(moonGeo,AU_SCENE*MOON_BOOST));
  const phase=Astronomy.MoonPhase(t);
  return {earth,moon,moonGeo,phase,illumination:(1-Math.cos(phase*Math.PI/180))/2,sunDirection:norm(sunGeo)};
}
function OrbitPath({radius,color}:{radius:number;color:string}) {
  const points=useMemo(()=>Array.from({length:241},(_,i)=>{const a=i/240*Math.PI*2;return [Math.cos(a)*radius,0,Math.sin(a)*radius] as [number,number,number]}),[radius]);
  return <Line points={points} color={color} transparent opacity={.4} lineWidth={1}/>;
}
function Scene({date,mode}:{date:Date;mode:string}) {
  const sky=useMemo(()=>calculate(date),[date.getTime()]);
  const earthRef=useRef<THREE.Group>(null), moonRef=useRef<THREE.Group>(null);
  useFrame(()=>{
    const sidereal=Astronomy.SiderealTime(new Astronomy.AstroTime(date));
    if(earthRef.current) earthRef.current.rotation.y=-(sidereal*Math.PI/12);
    if(moonRef.current) moonRef.current.rotation.y=date.getTime()/86400000*(2*Math.PI/27.321661);
  });
  const e=sky.earth,m=sky.moon,s=sky.sunDirection;
  const target:[number,number,number]=mode==='earth'?[e.x,e.y,e.z]:mode==='moon'?[m.x,m.y,m.z]:[0,0,0];
  return <>
    <color attach="background" args={['#080b16']}/>
    <ambientLight intensity={.18}/>
    <directionalLight position={[s.x*100,s.y*100,s.z*100]} intensity={2.8}/>
    <Stars radius={150} depth={65} count={3500} factor={3} saturation={.15} fade speed={.2}/>
    <mesh><sphereGeometry args={[.7,48,32]}/><meshBasicMaterial color="#ffd27a"/></mesh>
    <OrbitPath radius={5} color="#45536e"/>
    <Line points={[[e.x,e.y,e.z],[m.x,m.y,m.z]]} color="#8198b9" transparent opacity={.35} lineWidth={1}/>
    <group ref={earthRef} position={[e.x,e.y,e.z]}>
      <mesh><sphereGeometry args={[.32,64,48]}/><meshStandardMaterial color="#397fc0" roughness={.92}/></mesh>
      <mesh scale={1.012}><sphereGeometry args={[.32,48,32]}/><meshBasicMaterial color="#6eb6ff" wireframe transparent opacity={.035}/></mesh>
    </group>
    <group ref={moonRef} position={[m.x,m.y,m.z]}>
      <mesh><sphereGeometry args={[.105,64,48]}/><meshStandardMaterial color="#c9c9c2" roughness={1}/></mesh>
    </group>
    <Html position={[0,.95,0]} center><span className="space-label sun-label">SUN</span></Html>
    <Html position={[e.x,e.y+.52,e.z]} center><span className="space-label">EARTH</span></Html>
    <Html position={[m.x,m.y+.24,m.z]} center><span className="space-label">MOON</span></Html>
    <OrbitControls makeDefault enableDamping dampingFactor={.08} minDistance={1.5} maxDistance={30} target={target}/>
  </>;
}
const localInput=(d:Date)=>{const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
function phaseName(a:number) {
  const p=(a%360+360)%360;
  if(p<22.5||p>=337.5)return 'New Moon'; if(p<67.5)return 'Waxing Crescent';
  if(p<112.5)return 'First Quarter'; if(p<157.5)return 'Waxing Gibbous';
  if(p<202.5)return 'Full Moon'; if(p<247.5)return 'Waning Gibbous';
  if(p<292.5)return 'Last Quarter'; return 'Waning Crescent';
}
export default function App() {
  const [date,setDate]=useState(()=>new Date()),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[mode,setMode]=useState('system');
  useEffect(()=>{if(!playing)return;const id=window.setInterval(()=>setDate(d=>new Date(d.getTime()+60000*speed)),1000);return()=>window.clearInterval(id)},[playing,speed]);
  const sky=useMemo(()=>calculate(date),[date.getTime()]);
  const distance=mag(sky.moonGeo)*AU_KM;
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">◉</span><div><div className="brand-name">ORRERY</div><div className="brand-sub">A LIVING MODEL OF THE SKY</div></div></div><div className="live-indicator"><i/> EPHEMERIS ACTIVE</div></header>
    <section className="intro"><div className="eyebrow">THE CELESTIAL MECHANICS STUDIO</div><h1>Time is another<br/><em>dimension of space.</em></h1><p>Travel through dates. Watch the geometry of our nearest worlds change.</p></section>
    <section className="viewport"><div className="viewport-head"><span>01 / CELESTIAL VIEW</span><span>HELIOCENTRIC · 3D</span></div><Canvas camera={{position:[0,8,12],fov:42}}><Scene date={date} mode={mode}/></Canvas>
      <div className="view-switch">{([['system','SYSTEM'],['earth','EARTH'],['moon','MOON']] as const).map(([val,label])=><button key={val} className={mode===val?'selected':''} onClick={()=>setMode(val)}>{label}</button>)}</div><div className="canvas-hint">DRAG TO ORBIT · SCROLL TO ZOOM</div></section>
    <section className="control-panel"><div className="panel-title">02 / TIME MACHINE <span>LOCAL TIME · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
      <div className="time-row"><input aria-label="Date and time" type="datetime-local" value={localInput(date)} onChange={e=>{if(e.target.value)setDate(new Date(e.target.value))}}/><button className="now-btn" onClick={()=>setDate(new Date())}>NOW</button></div>
      <div className="transport"><button onClick={()=>setDate(d=>new Date(d.getTime()-86400000))}>− 1 DAY</button><button className="play-btn" onClick={()=>setPlaying(x=>!x)}>{playing?'Ⅱ PAUSE':'▶ PLAY TIME'}</button><button onClick={()=>setDate(d=>new Date(d.getTime()+86400000))}>+ 1 DAY</button>
        <select aria-label="Time speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={60}>1 min/s</option><option value={1440}>1 day/s</option><option value={10080}>1 week/s</option><option value={43200}>30 days/s</option></select></div></section>
    <section className="data-grid">
      <article className="data-card phase-card"><div className="card-kicker">03 / LUNAR PHASE</div><div className="phase-row"><div className="moon-glyph">◐</div><div><h2>{phaseName(sky.phase)}</h2><p>{(sky.illumination*100).toFixed(1)}% illuminated · {sky.phase.toFixed(1)}° phase angle</p></div></div><div className="meter"><span style={{width:`${sky.illumination*100}%`}}/></div></article>
      <article className="data-card"><div className="card-kicker">04 / EARTH–MOON</div><h2>{distance.toLocaleString('en-US',{maximumFractionDigits:0})} km</h2><p>Geocentric distance</p></article>
      <article className="data-card"><div className="card-kicker">05 / SIMULATION DATE</div><h2>{date.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}</h2><p>{date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · local</p></article>
    </section>
    <footer><span>ORRERY / FIELD NOTES 001</span><span>Positions calculated with Astronomy Engine · Body sizes and Moon distance visually exaggerated</span></footer>
  </main>;
}
