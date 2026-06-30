"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } from "three-stdlib";

const SITES = [
  { id: 1, name: "Shackleton Crater Rim", lat: -89.68, lon: 0.0, slope_deg: 3.2, solar_illumination_pct: 89, ice_proximity_km: 0.8, earth_comms_pct: 72, overall_score: 88, description: "Highest illumination of all sites. Ridge between Shackleton and de Gerlache provides near-continuous sunlight.", optimal: false },
  { id: 2, name: "de Gerlache Rim 1", lat: -88.65, lon: -68.4, slope_deg: 4.1, solar_illumination_pct: 84, ice_proximity_km: 1.2, earth_comms_pct: 68, overall_score: 82, description: "High solar exposure, access to permanently shadowed ice deposits.", optimal: false },
  { id: 3, name: "de Gerlache Rim 2", lat: -88.72, lon: -75.1, slope_deg: 4.8, solar_illumination_pct: 81, ice_proximity_km: 1.5, earth_comms_pct: 65, overall_score: 79, description: "Flat terrain, strong solar access, near permanently shadowed regions.", optimal: false },
  { id: 4, name: "Shackleton/de Gerlache Ridge", lat: -89.46, lon: -62.3, slope_deg: 5.0, solar_illumination_pct: 86, ice_proximity_km: 0.6, earth_comms_pct: 74, overall_score: 85, description: "Connects Shackleton and de Gerlache craters. Excellent comms and sustained power.", optimal: false },
  { id: 5, name: "Haworth", lat: -87.52, lon: -4.2, slope_deg: 6.1, solar_illumination_pct: 62, ice_proximity_km: 0.4, earth_comms_pct: 71, overall_score: 64, description: "Rich ice access but challenging illumination.", optimal: false },
  { id: 6, name: "Malapert Massif", lat: -86.03, lon: 0.5, slope_deg: 7.2, solar_illumination_pct: 78, ice_proximity_km: 2.1, earth_comms_pct: 91, overall_score: 74, description: "Highest Earth visibility of all sites due to elevated terrain. Steeper slopes.", optimal: false },
  { id: 7, name: "Leibnitz Beta Plateau", lat: -85.12, lon: 31.4, slope_deg: 2.8, solar_illumination_pct: 74, ice_proximity_km: 2.8, earth_comms_pct: 63, overall_score: 71, description: "Flattest terrain of all candidate sites. Good solar access, farther from ice.", optimal: false },
  { id: 8, name: "Nobile Rim 1", lat: -85.18, lon: 52.8, slope_deg: 4.4, solar_illumination_pct: 76, ice_proximity_km: 0.9, earth_comms_pct: 66, overall_score: 80, description: "Water ice confirmed in nearby permanently shadowed regions.", optimal: false },
  { id: 9, name: "Nobile Rim 2", lat: -84.20, lon: 60.70, slope_deg: 3.9, solar_illumination_pct: 77, ice_proximity_km: 0.7, earth_comms_pct: 68, overall_score: 91, description: "Scientifically optimal site. 36% of top-100 landing points are here. Best balance of all criteria.", optimal: true },
  { id: 10, name: "Connecting Ridge", lat: -89.02, lon: -130.5, slope_deg: 5.6, solar_illumination_pct: 80, ice_proximity_km: 1.1, earth_comms_pct: 58, overall_score: 73, description: "Links Shackleton and de Gerlache. Moderate comms due to longitude.", optimal: false },
  { id: 11, name: "Connecting Ridge Extension", lat: -88.48, lon: -128.2, slope_deg: 5.9, solar_illumination_pct: 78, ice_proximity_km: 1.3, earth_comms_pct: 56, overall_score: 70, description: "Extended ridge with similar characteristics to Connecting Ridge.", optimal: false },
  { id: 12, name: "Amundsen Crater Rim", lat: -84.12, lon: 84.7, slope_deg: 4.2, solar_illumination_pct: 71, ice_proximity_km: 1.8, earth_comms_pct: 61, overall_score: 68, description: "Large flat areas, significant science targets. Moderate ice access.", optimal: false },
  { id: 13, name: "Faustini Rim A", lat: -87.24, lon: 77.1, slope_deg: 6.8, solar_illumination_pct: 66, ice_proximity_km: 0.5, earth_comms_pct: 64, overall_score: 66, description: "Ice-rich location with challenging terrain. High science value, higher risk.", optimal: false },
];

type Site = typeof SITES[0];

function scoreColorHex(score: number) {
  if (score >= 85) return "#4ade80";
  if (score >= 75) return "#facc15";
  if (score >= 65) return "#fb923c";
  return "#f87171";
}
function scoreColorNum(score: number) {
  return parseInt(scoreColorHex(score).slice(1), 16);
}

function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

const MOON_RADIUS = 1;
const EARTH_RADIUS = 3.67;
const MOON_CENTER = new THREE.Vector3(0, 0, 0);
const EARTH_CENTER = new THREE.Vector3(-26, 4, -8);

const INTRO_CAM = new THREE.Vector3(-31.8, 7.4, -3.1);
const INTRO_LOOK = new THREE.Vector3(-13.0, 2.0, -4.0);
const POLE_CAM = new THREE.Vector3(0, -2.6, 1.3);

export default function MoonGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"intro" | "map">("intro");
  const [selected, setSelected] = useState<Site | null>(null);
  const [hovered, setHovered] = useState<Site | null>(null);

  const flyRequested = useRef(false);
  const flyStart = useRef<{ t: number } | null>(null);

  const startFly = () => {
    flyRequested.current = true;
    setPhase("map");
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.01, 4000);
    camera.position.copy(INTRO_CAM);
    camera.lookAt(INTRO_LOOK);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.4, 0.5, 0.85);
    composer.addPass(bloom);

    // OrbitControls created ONLY after fly-to completes (prevents intro camera jump)
    let controls: OrbitControls | null = null;
    function createControls() {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.4;
      controls.minDistance = 1.4;
      controls.maxDistance = 6;
      controls.enablePan = false;
      controls.target.copy(MOON_CENTER);
    }

    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // MOON
    const moonTex = loader.load("/moon.jpg");
    moonTex.anisotropy = maxAniso;
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS, 128, 128),
      new THREE.MeshPhongMaterial({ map: moonTex, shininess: 3 })
    );
    moon.position.copy(MOON_CENTER);
    moon.rotation.y = Math.PI / 2;
    scene.add(moon);

    // EARTH
    const earthGroup = new THREE.Group();
    earthGroup.position.copy(EARTH_CENTER);
    const earthTex = loader.load("/earth.jpg");
    earthTex.anisotropy = maxAniso;
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const earthMatOpts: THREE.MeshPhongMaterialParameters = {
      map: earthTex,
      shininess: 25,
      specular: new THREE.Color(0x666666),
      emissive: new THREE.Color(0x0a0a14),
      emissiveIntensity: 0.3,
    };
    earthMatOpts.specularMap = loader.load("/earth_specular.jpg");
    earthMatOpts.normalMap = loader.load("/earth_normal.png");
    const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 128, 128), new THREE.MeshPhongMaterial(earthMatOpts));
    earthGroup.add(earth);

    const cloudTex = loader.load("/earth_clouds.jpg");
    cloudTex.anisotropy = maxAniso;
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.01, 128, 128),
      new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false })
    );
    earthGroup.add(clouds);

    // ATMOSPHERE — limb glow that fades into space
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0x5aa6ff) } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = dot(vNormal, vView);
          float edge = pow(1.0 - rim, 2.0) * smoothstep(0.0, 0.3, rim);
          gl_FragColor = vec4(glowColor, clamp(edge, 0.0, 1.0) * 1.2);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 96, 96), atmoMat);
    earthGroup.add(atmo);
    scene.add(earthGroup);

    // LIGHTING
    scene.add(new THREE.AmbientLight(0x55606e, 1.4));
    const sun = new THREE.DirectionalLight(0xfff5e8, 2.6);
    sun.position.set(-15, 12, 35);
    scene.add(sun);

    // STARS
    const starGeo = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 300 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.0, sizeAttenuation: false, transparent: true, opacity: 0.8 })
    );
    scene.add(stars);

    // SITE MARKERS
    const markerGroup = new THREE.Group();
    moon.add(markerGroup);
    const markers: { mesh: THREE.Mesh; site: Site }[] = [];

    SITES.forEach((site) => {
      const pos = latLonToVec3(site.lat, site.lon, MOON_RADIUS + 0.005);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.009, 12, 12),
        new THREE.MeshBasicMaterial({ color: scoreColorNum(site.overall_score) })
      );
      dot.position.copy(pos);
      dot.userData = { site };
      markerGroup.add(dot);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: scoreColorNum(site.overall_score), transparent: true, opacity: 0.35, depthWrite: false }));
      halo.scale.setScalar(0.05);
      halo.position.copy(pos);
      markerGroup.add(halo);

      markers.push({ mesh: dot, site });

      if (site.optimal) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.022, 0.028, 48),
          new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
        );
        ring.position.copy(pos);
        ring.lookAt(pos.clone().multiplyScalar(2));
        markerGroup.add(ring);
      }
    });

    // RAYCASTER
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const setMouse = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };
    const onClick = (e: MouseEvent) => {
      if (!controls) return;
      setMouse(e);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(markers.map((m) => m.mesh));
      if (hits.length) setSelected(hits[0].object.userData.site as Site);
    };
    const onMove = (e: MouseEvent) => {
      if (!controls) return;
      setMouse(e);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(markers.map((m) => m.mesh));
      if (hits.length) {
        setHovered(hits[0].object.userData.site as Site);
        renderer.domElement.style.cursor = "pointer";
      } else {
        setHovered(null);
        renderer.domElement.style.cursor = "grab";
      }
    };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousemove", onMove);

    // LOOP
    let frame: number;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      earth.rotation.y += 0.0006;
      clouds.rotation.y += 0.0009;

      if (flyRequested.current && !flyStart.current) {
        flyRequested.current = false;
        // snap to exact intro pose so there is zero jump
        camera.position.copy(INTRO_CAM);
        camera.lookAt(INTRO_LOOK);
        flyStart.current = { t: 0 };
      }

      if (flyStart.current) {
        const f = flyStart.current;
        f.t += 0.0075;
        const tt = Math.min(f.t < 0.5 ? 4 * f.t * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 3) / 2, 1);
        camera.position.lerpVectors(INTRO_CAM, POLE_CAM, tt);
        const curLook = new THREE.Vector3().lerpVectors(INTRO_LOOK, MOON_CENTER, tt);
        camera.lookAt(curLook);
        if (f.t >= 1) {
          flyStart.current = null;
          camera.position.copy(POLE_CAM);
          camera.lookAt(MOON_CENTER);
          createControls();
        }
      }

      const t = Date.now() * 0.003;
      markers.forEach(({ mesh }) => mesh.scale.setScalar(1 + Math.sin(t) * 0.25));

      if (controls) controls.update();
      composer.render();
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousemove", onMove);
      if (controls) controls.dispose();
      renderer.dispose();
      composer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />

      {phase === "intro" && (
        <div className="absolute inset-0 flex items-center justify-end pr-[8%] pointer-events-none">
          <div className="text-right max-w-lg">
            <p className="text-xs tracking-[0.4em] text-gray-400 mb-4 uppercase">NASA Artemis Mission Planning</p>
            <h1 className="text-7xl font-bold text-white tracking-tight leading-[0.95] mb-1">ARTEMIS</h1>
            <h1 className="text-7xl font-bold tracking-tight leading-[0.95] mb-6" style={{ color: "#4ade80" }}>NAVIGATOR</h1>
            <p className="text-gray-400 text-sm mb-8 ml-auto max-w-sm leading-relaxed">
              Preliminary mission analysis using real NASA orbital data, LRO terrain maps, and JPL Horizons ephemeris
            </p>
            <button
              className="pointer-events-auto px-10 py-3 text-sm font-medium tracking-widest uppercase border border-green-400 text-green-400 hover:bg-green-400 hover:text-black transition-all duration-200"
              style={{ letterSpacing: "0.2em" }}
              onClick={startFly}
            >
              Plan a Mission →
            </button>
            <div className="mt-10 flex gap-4 justify-end text-[10px] text-gray-600 tracking-wider">
              <span>JPL HORIZONS</span><span>·</span>
              <span>LRO LOLA</span><span>·</span>
              <span>LROC WAC</span><span>·</span>
              <span>NOAA</span>
            </div>
          </div>
        </div>
      )}

      {phase === "map" && !selected && (
        <div className="absolute top-6 left-6 text-xs text-gray-500 tracking-wider">
          <p className="uppercase mb-1">Lunar South Pole — 13 Candidate Sites</p>
          <p className="text-gray-600">Drag to rotate · scroll to zoom · click a site</p>
        </div>
      )}

      {phase === "map" && hovered && !selected && (
        <div className="absolute top-6 right-6 bg-gray-950 border border-gray-800 px-4 py-2 text-xs">
          <span className="text-white font-bold">{hovered.name}</span>
          <span className="ml-2" style={{ color: scoreColorHex(hovered.overall_score) }}>{hovered.overall_score}</span>
        </div>
      )}

      {selected && (
        <div className="absolute top-6 right-6 w-80 border border-gray-800 bg-gray-950/95 p-6 backdrop-blur-sm">
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs tracking-widest text-gray-500 uppercase">Site {selected.id}</p>
            <div className="text-3xl font-bold" style={{ color: scoreColorHex(selected.overall_score) }}>{selected.overall_score}</div>
          </div>
          <h2 className="text-white font-bold text-lg leading-tight mb-1">{selected.name}</h2>
          {selected.optimal && <p className="text-xs text-green-400 tracking-wider mb-3">★ SCIENTIFICALLY OPTIMAL</p>}
          <p className="text-gray-400 text-xs mb-5 leading-relaxed">{selected.description}</p>
          <div className="grid grid-cols-2 gap-3 text-xs mb-5">
            <div><p className="text-gray-600">Solar</p><p className="text-white font-mono">{selected.solar_illumination_pct}%</p></div>
            <div><p className="text-gray-600">Comms</p><p className="text-white font-mono">{selected.earth_comms_pct}%</p></div>
            <div><p className="text-gray-600">Slope</p><p className="text-white font-mono">{selected.slope_deg}°</p></div>
            <div><p className="text-gray-600">Ice Dist</p><p className="text-white font-mono">{selected.ice_proximity_km} km</p></div>
          </div>
          <button className="w-full py-2 text-xs tracking-widest uppercase border border-green-400 text-green-400 hover:bg-green-400 hover:text-black transition-all duration-200">
            Select This Site →
          </button>
          <button onClick={() => setSelected(null)} className="w-full mt-2 py-1 text-xs text-gray-600 hover:text-white">
            ← Back to all sites
          </button>
        </div>
      )}
    </div>
  );
}