"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } from "three-stdlib";

type SiteType = "artemis" | "apollo";

interface Site {
  id: number;
  name: string;
  type: SiteType;
  lat: number;
  lon: number;
  slope_deg?: number;
  solar_illumination_pct?: number;
  ice_proximity_km?: number;
  earth_comms_pct?: number;
  overall_score?: number;
  optimal?: boolean;
  description?: string;
  year?: number;
  crew?: string;
  mission_summary?: string;
}

interface PreciseSite {
  region_id: number;
  region_name: string;
  lat: number;
  lon: number;
  footprint_mean_slope_deg: number;
  center_pixel_slope_deg: number;
  footprint_m: number;
  region_mean_slope_deg: number;
  region_min_slope_deg: number;
  resolution_m: number;
  source: string;
}

const ARTEMIS_SITES: Site[] = [
  { id: 1, type: "artemis", name: "Shackleton Crater Rim", lat: -89.68, lon: 0.0, slope_deg: 3.2, solar_illumination_pct: 89, ice_proximity_km: 0.8, earth_comms_pct: 72, overall_score: 88, description: "Highest illumination of all sites. Ridge between Shackleton and de Gerlache provides near-continuous sunlight." },
  { id: 2, type: "artemis", name: "de Gerlache Rim 1", lat: -88.65, lon: -68.4, slope_deg: 4.1, solar_illumination_pct: 84, ice_proximity_km: 1.2, earth_comms_pct: 68, overall_score: 82, description: "High solar exposure, access to permanently shadowed ice deposits." },
  { id: 3, type: "artemis", name: "de Gerlache Rim 2", lat: -88.72, lon: -75.1, slope_deg: 4.8, solar_illumination_pct: 81, ice_proximity_km: 1.5, earth_comms_pct: 65, overall_score: 79, description: "Flat terrain, strong solar access, near permanently shadowed regions." },
  { id: 4, type: "artemis", name: "Shackleton/de Gerlache Ridge", lat: -89.46, lon: -62.3, slope_deg: 5.0, solar_illumination_pct: 86, ice_proximity_km: 0.6, earth_comms_pct: 74, overall_score: 85, description: "Connects Shackleton and de Gerlache craters. Excellent comms and sustained power." },
  { id: 5, type: "artemis", name: "Haworth", lat: -87.52, lon: -4.2, slope_deg: 6.1, solar_illumination_pct: 62, ice_proximity_km: 0.4, earth_comms_pct: 71, overall_score: 64, description: "Rich ice access but challenging illumination." },
  { id: 6, type: "artemis", name: "Malapert Massif", lat: -86.03, lon: 0.5, slope_deg: 7.2, solar_illumination_pct: 78, ice_proximity_km: 2.1, earth_comms_pct: 91, overall_score: 74, description: "Highest Earth visibility of all sites due to elevated terrain. Steeper slopes." },
  { id: 7, type: "artemis", name: "Leibnitz Beta Plateau", lat: -85.12, lon: 31.4, slope_deg: 2.8, solar_illumination_pct: 74, ice_proximity_km: 2.8, earth_comms_pct: 63, overall_score: 71, description: "Flattest terrain of all candidate sites. Good solar access, farther from ice." },
  { id: 8, type: "artemis", name: "Nobile Rim 1", lat: -85.18, lon: 52.8, slope_deg: 4.4, solar_illumination_pct: 76, ice_proximity_km: 0.9, earth_comms_pct: 66, overall_score: 80, description: "Water ice confirmed in nearby permanently shadowed regions." },
  { id: 9, type: "artemis", name: "Nobile Rim 2", lat: -84.20, lon: 60.70, slope_deg: 3.9, solar_illumination_pct: 77, ice_proximity_km: 0.7, earth_comms_pct: 68, overall_score: 91, optimal: true, description: "Scientifically optimal site. 36% of top-100 landing points are here. Best balance of all criteria." },
  { id: 10, type: "artemis", name: "Connecting Ridge", lat: -89.02, lon: -130.5, slope_deg: 5.6, solar_illumination_pct: 80, ice_proximity_km: 1.1, earth_comms_pct: 58, overall_score: 73, description: "Links Shackleton and de Gerlache. Moderate comms due to longitude." },
  { id: 11, type: "artemis", name: "Connecting Ridge Extension", lat: -88.48, lon: -128.2, slope_deg: 5.9, solar_illumination_pct: 78, ice_proximity_km: 1.3, earth_comms_pct: 56, overall_score: 70, description: "Extended ridge with similar characteristics to Connecting Ridge." },
  { id: 12, type: "artemis", name: "Amundsen Crater Rim", lat: -84.12, lon: 84.7, slope_deg: 4.2, solar_illumination_pct: 71, ice_proximity_km: 1.8, earth_comms_pct: 61, overall_score: 68, description: "Large flat areas, significant science targets. Moderate ice access." },
  { id: 13, type: "artemis", name: "Faustini Rim A", lat: -87.24, lon: 77.1, slope_deg: 6.8, solar_illumination_pct: 66, ice_proximity_km: 0.5, earth_comms_pct: 64, overall_score: 66, description: "Ice-rich location with challenging terrain. High science value, higher risk." },
];

const APOLLO_SITES: Site[] = [
  { id: 101, type: "apollo", name: "Apollo 11", lat: 0.67, lon: 23.47, year: 1969, crew: "Armstrong, Aldrin, Collins", mission_summary: "First crewed lunar landing. Sea of Tranquility (Mare Tranquillitatis)." },
  { id: 102, type: "apollo", name: "Apollo 12", lat: -3.01, lon: -23.42, year: 1969, crew: "Conrad, Bean, Gordon", mission_summary: "Precision landing near Surveyor 3. Ocean of Storms (Oceanus Procellarum)." },
  { id: 103, type: "apollo", name: "Apollo 14", lat: -3.65, lon: -17.47, year: 1971, crew: "Shepard, Mitchell, Roosa", mission_summary: "Fra Mauro highlands. First use of the Modular Equipment Transporter." },
  { id: 104, type: "apollo", name: "Apollo 15", lat: 26.13, lon: 3.63, year: 1971, crew: "Scott, Irwin, Worden", mission_summary: "Hadley-Apennine. First Lunar Roving Vehicle mission." },
  { id: 105, type: "apollo", name: "Apollo 16", lat: -8.97, lon: 15.50, year: 1972, crew: "Young, Duke, Mattingly", mission_summary: "Descartes Highlands. First landing in the lunar highlands." },
  { id: 106, type: "apollo", name: "Apollo 17", lat: 20.19, lon: 30.77, year: 1972, crew: "Cernan, Schmitt, Evans", mission_summary: "Taurus-Littrow. Last crewed lunar landing; first geologist on the Moon." },
];

const ALL_SITES = [...ARTEMIS_SITES, ...APOLLO_SITES];

function scoreColorHex(score?: number) {
  if (score === undefined) return "#9ca3af";
  if (score >= 85) return "#4ade80";
  if (score >= 75) return "#facc15";
  if (score >= 65) return "#fb923c";
  return "#f87171";
}
function scoreColorNum(score?: number) {
  return parseInt(scoreColorHex(score).slice(1), 16);
}
const APOLLO_COLOR_HEX = "#e8b04b";
const APOLLO_COLOR_NUM = 0xe8b04b;

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
const OVERVIEW_CAM = new THREE.Vector3(0, 0, 3.4);

type SearchState = "idle" | "scanning" | "found" | "unavailable";

export default function MoonGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"intro" | "map">("intro");
  const [selected, setSelected] = useState<Site | null>(null);
  const [hovered, setHovered] = useState<Site | null>(null);

  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [preciseResult, setPreciseResult] = useState<PreciseSite | null>(null);
  const [confirmed, setConfirmed] = useState<PreciseSite | null>(null);

  const flyRequested = useRef(false);
  const flyStart = useRef<{ t: number } | null>(null);
  const siteFly = useRef<{ from: THREE.Vector3; to: THREE.Vector3; lookTo: THREE.Vector3; t: number } | null>(null);
  const flyToSiteRef = useRef<(site: Site) => void>(() => {});

  const startFly = () => {
    flyRequested.current = true;
    setPhase("map");
  };

  const handleSelectSite = (site: Site) => {
    setSelected(site);
    setSearchState("idle");
    setPreciseResult(null);
    setConfirmed(null);
    flyToSiteRef.current(site);
  };

  const handleSearchArea = async (site: Site) => {
    setSearchState("scanning");
    setPreciseResult(null);
    try {
      const res = await fetch("/precise_sites.json");
      const data = await res.json();
      const match: PreciseSite | undefined = data.sites?.find(
        (s: PreciseSite) => s.region_id === site.id
      );
      setTimeout(() => {
        if (match) { setPreciseResult(match); setSearchState("found"); }
        else { setSearchState("unavailable"); }
      }, 1600);
    } catch {
      setTimeout(() => setSearchState("unavailable"), 1000);
    }
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

    const earthGroup = new THREE.Group();
    earthGroup.position.copy(EARTH_CENTER);
    const earthTex = loader.load("/earth.jpg");
    earthTex.anisotropy = maxAniso;
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const earthMatOpts: THREE.MeshPhongMaterialParameters = {
      map: earthTex, shininess: 25, specular: new THREE.Color(0x666666),
      emissive: new THREE.Color(0x0a0a14), emissiveIntensity: 0.3,
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

    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0x5aa6ff) } },
      vertexShader: "varying vec3 vNormal; varying vec3 vView; void main(){ vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=dot(vNormal,vView); float edge=pow(1.0-rim,2.0)*smoothstep(0.0,0.3,rim); gl_FragColor=vec4(glowColor,clamp(edge,0.0,1.0)*1.2); }",
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.015, 96, 96), atmoMat);
    earthGroup.add(atmo);
    scene.add(earthGroup);

    scene.add(new THREE.AmbientLight(0x55606e, 1.4));
    const sun = new THREE.DirectionalLight(0xfff5e8, 2.6);
    sun.position.set(-15, 12, 35);
    scene.add(sun);

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
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.0, sizeAttenuation: false, transparent: true, opacity: 0.8 })));

    const markerGroup = new THREE.Group();
    moon.add(markerGroup);
    const markers: { mesh: THREE.Mesh; site: Site }[] = [];

    ALL_SITES.forEach((site) => {
      const isApollo = site.type === "apollo";
      const colorNum = isApollo ? APOLLO_COLOR_NUM : scoreColorNum(site.overall_score);
      const pos = latLonToVec3(site.lat, site.lon, MOON_RADIUS + 0.005);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 12), new THREE.MeshBasicMaterial({ color: colorNum }));
      dot.position.copy(pos);
      dot.userData = { site };
      markerGroup.add(dot);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: colorNum, transparent: true, opacity: 0.3, depthWrite: false }));
      halo.scale.setScalar(0.05);
      halo.position.copy(pos);
      markerGroup.add(halo);
      markers.push({ mesh: dot, site });
      if (isApollo) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 4), new THREE.MeshBasicMaterial({ color: APOLLO_COLOR_NUM, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
        ring.position.copy(pos); ring.lookAt(pos.clone().multiplyScalar(2)); markerGroup.add(ring);
      } else if (site.optimal) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.028, 48), new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
        ring.position.copy(pos); ring.lookAt(pos.clone().multiplyScalar(2)); markerGroup.add(ring);
      }
    });

    flyToSiteRef.current = (site: Site) => {
      const local = latLonToVec3(site.lat, site.lon, MOON_RADIUS + 0.005);
      const world = local.clone().applyMatrix4(moon.matrixWorld);
      const normal = world.clone().sub(MOON_CENTER).normalize();
      const camPos = MOON_CENTER.clone().add(normal.multiplyScalar(2.1));
      siteFly.current = { from: camera.position.clone(), to: camPos, lookTo: world.clone(), t: 0 };
      if (controls) controls.enabled = false;
    };

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
      if (hits.length) handleSelectSite(hits[0].object.userData.site as Site);
    };
    const onMove = (e: MouseEvent) => {
      if (!controls) return;
      setMouse(e);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(markers.map((m) => m.mesh));
      if (hits.length) { setHovered(hits[0].object.userData.site as Site); renderer.domElement.style.cursor = "pointer"; }
      else { setHovered(null); renderer.domElement.style.cursor = "grab"; }
    };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousemove", onMove);

    let frame: number;
    const tmpLook = new THREE.Vector3();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      earth.rotation.y += 0.0006;
      clouds.rotation.y += 0.0009;

      if (flyRequested.current && !flyStart.current) {
        flyRequested.current = false;
        camera.position.copy(INTRO_CAM);
        camera.lookAt(INTRO_LOOK);
        flyStart.current = { t: 0 };
      }
      if (flyStart.current) {
        const f = flyStart.current;
        f.t += 0.0075;
        const tt = Math.min(f.t < 0.5 ? 4 * f.t * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 3) / 2, 1);
        camera.position.lerpVectors(INTRO_CAM, OVERVIEW_CAM, tt);
        tmpLook.lerpVectors(INTRO_LOOK, MOON_CENTER, tt);
        camera.lookAt(tmpLook);
        if (f.t >= 1) { flyStart.current = null; camera.position.copy(OVERVIEW_CAM); camera.lookAt(MOON_CENTER); createControls(); }
      }
      if (siteFly.current) {
        const s = siteFly.current;
        s.t += 0.02;
        const tt = Math.min(s.t < 0.5 ? 4 * s.t * s.t * s.t : 1 - Math.pow(-2 * s.t + 2, 3) / 2, 1);
        camera.position.lerpVectors(s.from, s.to, tt);
        camera.lookAt(s.lookTo);
        if (s.t >= 1) { if (controls) { controls.enabled = true; controls.target.copy(MOON_CENTER); } siteFly.current = null; }
      }

      const t = Date.now() * 0.003;
      markers.forEach(({ mesh }) => mesh.scale.setScalar(1 + Math.sin(t) * 0.25));

      if (controls && !siteFly.current) controls.update();
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
              <span>JPL HORIZONS</span><span>·</span><span>LRO LOLA</span><span>·</span><span>LROC WAC</span><span>·</span><span>NOAA</span>
            </div>
          </div>
        </div>
      )}

      {phase === "map" && !selected && (
        <>
          <div className="absolute top-6 left-6 text-xs text-gray-500 tracking-wider">
            <p className="uppercase mb-1">Select a Landing Region</p>
            <p className="text-gray-600">Drag to rotate · scroll to zoom · click a site</p>
          </div>
          <div className="absolute bottom-6 left-6 flex gap-5 text-[11px] text-gray-500">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#4ade80" }} /> Artemis candidate (south pole)</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 inline-block" style={{ backgroundColor: APOLLO_COLOR_HEX }} /> Apollo historic site</span>
          </div>
        </>
      )}

      {phase === "map" && hovered && !selected && (
        <div className="absolute top-6 right-6 bg-gray-950 border border-gray-800 px-4 py-2 text-xs">
          <span className="text-white font-bold">{hovered.name}</span>
          {hovered.type === "artemis"
            ? <span className="ml-2" style={{ color: scoreColorHex(hovered.overall_score) }}>{hovered.overall_score}</span>
            : <span className="ml-2" style={{ color: APOLLO_COLOR_HEX }}>{hovered.year}</span>}
        </div>
      )}

      {selected && (
        <div className="absolute top-6 right-6 w-80 border border-gray-800 bg-gray-950/95 p-6 backdrop-blur-sm">
          {selected.type === "artemis" ? (
            <>
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs tracking-widest text-gray-500 uppercase">Artemis Candidate · Site {selected.id}</p>
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
            </>
          ) : (
            <>
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs tracking-widest uppercase" style={{ color: APOLLO_COLOR_HEX }}>Apollo Historic Site</p>
                <div className="text-2xl font-bold" style={{ color: APOLLO_COLOR_HEX }}>{selected.year}</div>
              </div>
              <h2 className="text-white font-bold text-lg leading-tight mb-1">{selected.name}</h2>
              <p className="text-gray-500 text-[11px] mb-3">Crew: {selected.crew}</p>
              <p className="text-gray-400 text-xs mb-5 leading-relaxed">{selected.mission_summary}</p>
            </>
          )}

          {searchState === "idle" && !confirmed && (
            <button
              className="w-full py-2 text-xs tracking-widest uppercase border transition-all duration-200"
              style={selected.type === "apollo" ? { borderColor: APOLLO_COLOR_HEX, color: APOLLO_COLOR_HEX } : { borderColor: "#4ade80", color: "#4ade80" }}
              onClick={() => handleSearchArea(selected)}
            >
              Search Area →
            </button>
          )}

          {searchState === "scanning" && (
            <div className="border border-gray-800 bg-black/40 p-4 text-center">
              <p className="text-xs text-green-400 tracking-widest uppercase animate-pulse mb-2">Analyzing terrain…</p>
              <p className="text-[10px] text-gray-600">Scanning 5 m/px LOLA DEM · evaluating lander-footprint slope</p>
            </div>
          )}

          {searchState === "found" && preciseResult && (
            <div className="border border-green-900 bg-green-950/20 p-4">
              <p className="text-[10px] tracking-widest text-green-400 uppercase mb-2">Optimal Landing Point Found</p>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><p className="text-gray-600">Latitude</p><p className="text-white font-mono">{preciseResult.lat.toFixed(4)}°</p></div>
                <div><p className="text-gray-600">Longitude</p><p className="text-white font-mono">{preciseResult.lon.toFixed(4)}°</p></div>
                <div><p className="text-gray-600">Footprint slope</p><p className="text-white font-mono">{preciseResult.footprint_mean_slope_deg}°</p></div>
                <div><p className="text-gray-600">Resolution</p><p className="text-white font-mono">{preciseResult.resolution_m} m/px</p></div>
              </div>
              <p className="text-[9px] text-gray-600 mb-3 leading-relaxed">{preciseResult.source}</p>
              {!confirmed ? (
                <button
                  className="w-full py-2 text-xs tracking-widest uppercase border border-green-400 text-green-400 hover:bg-green-400 hover:text-black transition-all"
                  onClick={() => setConfirmed(preciseResult)}
                >
                  Confirm Site →
                </button>
              ) : (
                <p className="text-center text-xs text-green-400 tracking-widest uppercase">✓ Site Confirmed</p>
              )}
            </div>
          )}

          {searchState === "unavailable" && (
            <div className="border border-gray-800 bg-black/40 p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Precise analysis not yet available</p>
              <p className="text-[10px] text-gray-600">5 m DEM processing is currently available for select regions (Nobile Rim 2, Haworth, Shackleton).</p>
              <button className="mt-3 text-[10px] text-gray-500 hover:text-white" onClick={() => setSearchState("idle")}>← Back</button>
            </div>
          )}

          <button onClick={() => { setSelected(null); setSearchState("idle"); setPreciseResult(null); setConfirmed(null); }} className="w-full mt-2 py-1 text-xs text-gray-600 hover:text-white">
            ← Back to all sites
          </button>
        </div>
      )}
    </div>
  );
}
