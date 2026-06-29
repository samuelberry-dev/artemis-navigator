"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function MoonGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 2.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // Moon sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // Load moon texture
    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load(
        "/moon.jpg",
      undefined,
      undefined,
      () => {
        // Fallback to basic gray if texture fails
        material.color.set(0x888888);
      }
    );

    const material = new THREE.MeshPhongMaterial({
      map: moonTexture,
      bumpScale: 0.02,
    });

    const moon = new THREE.Mesh(geometry, material);
    scene.add(moon);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Stars background
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 200;
    }
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Slow rotation
    const animate = () => {
      requestAnimationFrame(animate);
      moon.rotation.y += 0.001;
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />

      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-xs tracking-[0.4em] text-gray-400 mb-3 uppercase">
            NASA Artemis Mission Planning
          </p>
          <h1 className="text-6xl font-bold text-white tracking-tight mb-2">
            ARTEMIS
          </h1>
          <h1 className="text-6xl font-bold tracking-tight mb-6"
              style={{ color: "#4ade80" }}>
            NAVIGATOR
          </h1>
          <p className="text-gray-400 text-sm mb-8 max-w-md">
            Preliminary mission analysis using real NASA orbital data,
            LRO terrain maps, and JPL Horizons ephemeris
          </p>
          <button
            className="pointer-events-auto px-8 py-3 text-sm font-medium tracking-widest uppercase border border-green-400 text-green-400 hover:bg-green-400 hover:text-black transition-all duration-200"
            style={{ letterSpacing: "0.2em" }}
          >
            Plan a Mission →
          </button>
        </div>

        {/* Data badges */}
        <div className="absolute bottom-8 flex gap-6 text-xs text-gray-500 tracking-wider">
          <span>NASA JPL HORIZONS</span>
          <span>·</span>
          <span>LRO LOLA TERRAIN</span>
          <span>·</span>
          <span>LROC ILLUMINATION</span>
          <span>·</span>
          <span>NOAA WEATHER</span>
        </div>
      </div>
    </div>
  );
}