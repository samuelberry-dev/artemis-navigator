// orbital.ts
// -------------------------------------------------------------------------
// Time -> Earth/Moon geometry for Artemis Navigator.
//
// This module is deliberately standalone and side-effect free so its numbers
// can be verified against a real ephemeris BEFORE it is wired into the 3D
// scene. Everything is derived from a timestamp (JS Date, treated as UTC).
//
// Accuracy: uses standard mean orbital elements (Meeus, "Astronomical
// Algorithms"). Good to ~1 degree for the Moon's position and phase — honest
// as an astronomical visualization. Exact JPL-ephemeris placement is a later
// upgrade via the Horizons backend.
// -------------------------------------------------------------------------

export interface EarthMoonState {
  julianDate: number;
  // Earth rotation about its axis (radians), for texturing the globe correctly
  earthRotationRad: number;
  // Moon geocentric ecliptic position (kilometers), Earth at origin
  moonPos: { x: number; y: number; z: number };
  moonDistanceKm: number;
  // Direction from Earth to Sun (unit vector, ecliptic frame)
  sunDir: { x: number; y: number; z: number };
  // Moon phase: 0=new, 0.5=full, plus a 0..1 illuminated fraction
  moonPhase: number;
  moonIlluminatedFraction: number;
  // Moon's own spin (radians) — tidally locked to its orbital longitude
  moonSpinRad: number;
}

const DEG = Math.PI / 180;
const J2000 = 2451545.0; // Julian date of 2000-01-01 12:00 TT

// Real physical constants
export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737.4;
export const MOON_MEAN_DISTANCE_KM = 384400;
const SIDEREAL_DAY_SEC = 86164.0905; // Earth's true rotation period
const MOON_INCLINATION = 5.145 * DEG; // orbital plane tilt to ecliptic

// --- date helpers -------------------------------------------------------

export function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function normalizeRad(a: number): number {
  a %= 2 * Math.PI;
  return a < 0 ? a + 2 * Math.PI : a;
}

// --- Sun position (low-precision, Meeus ch.25) --------------------------

function sunEclipticLongitude(T: number): number {
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) * DEG;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) * DEG +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) * DEG +
    0.000289 * Math.sin(3 * M) * DEG;
  return normalizeRad(L0 + C);
}

// --- Moon position (Meeus ch.47, truncated main terms) ------------------

function moonEcliptic(T: number): { lon: number; lat: number; distKm: number } {
  // Mean elements (degrees)
  const Lp = 218.3164477 + 481267.88123421 * T; // mean longitude
  const D = 297.8501921 + 445267.1114034 * T; // mean elongation
  const M = 357.5291092 + 35999.0502909 * T; // sun mean anomaly
  const Mp = 134.9633964 + 477198.8675055 * T; // moon mean anomaly
  const F = 93.272095 + 483202.0175233 * T; // argument of latitude

  const d = D * DEG, m = M * DEG, mp = Mp * DEG, f = F * DEG;

  // Longitude terms (deg), main periodic terms
  let lon =
    Lp +
    6.288774 * Math.sin(mp) +
    1.274027 * Math.sin(2 * d - mp) +
    0.658314 * Math.sin(2 * d) +
    0.213618 * Math.sin(2 * mp) -
    0.185116 * Math.sin(m) -
    0.114332 * Math.sin(2 * f);

  // Latitude terms (deg), main periodic terms
  const lat =
    5.128122 * Math.sin(f) +
    0.280602 * Math.sin(mp + f) +
    0.277693 * Math.sin(mp - f) +
    0.173237 * Math.sin(2 * d - f) +
    0.055413 * Math.sin(2 * d - mp + f);

  // Distance (km): 385000.56 - sum of cosine terms (km)
  const distKm =
    385000.56 -
    20905.355 * Math.cos(mp) -
    3699.111 * Math.cos(2 * d - mp) -
    2955.968 * Math.cos(2 * d) -
    569.925 * Math.cos(2 * mp);

  return { lon: normalizeRad(lon * DEG), lat: lat * DEG, distKm };
}

// --- main entry ---------------------------------------------------------

export function computeState(date: Date): EarthMoonState {
  const jd = toJulianDate(date);
  const T = (jd - J2000) / 36525; // Julian centuries since J2000

  // Earth rotation: sidereal angle. Anchor so texture longitude lines up.
  const secondsSinceJ2000 = (jd - J2000) * 86400;
  const earthRotationRad = normalizeRad(
    (2 * Math.PI * secondsSinceJ2000) / SIDEREAL_DAY_SEC
  );

  // Sun direction in ecliptic frame (unit vector)
  const sunLon = sunEclipticLongitude(T);
  const sunDir = { x: Math.cos(sunLon), y: 0, z: Math.sin(sunLon) };

  // Moon ecliptic spherical -> cartesian (km), Earth at origin.
  const { lon, lat, distKm } = moonEcliptic(T);
  const moonPos = {
    x: distKm * Math.cos(lat) * Math.cos(lon),
    y: distKm * Math.sin(lat), // out of ecliptic plane
    z: distKm * Math.cos(lat) * Math.sin(lon),
  };
  void MOON_INCLINATION; // inclination already folded into lat terms

  // Moon phase = angular elongation between Moon and Sun as seen from Earth
  const elong = normalizeRad(lon - sunLon);
  const moonPhase = elong / (2 * Math.PI); // 0 new -> 0.5 full -> 1 new
  const moonIlluminatedFraction = (1 - Math.cos(elong)) / 2;

  // Tidal lock: the Moon's near side always faces Earth, so its spin angle
  // equals its orbital longitude (plus a constant we fold in at texture time).
  const moonSpinRad = lon;

  return {
    julianDate: jd,
    earthRotationRad,
    moonPos,
    moonDistanceKm: distKm,
    sunDir,
    moonPhase,
    moonIlluminatedFraction,
    moonSpinRad,
  };
}

// Quick human-readable phase name for the time-bar readout.
export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p > 0.97) return "New Moon";
  if (p < 0.22) return "Waxing Crescent";
  if (p < 0.28) return "First Quarter";
  if (p < 0.47) return "Waxing Gibbous";
  if (p < 0.53) return "Full Moon";
  if (p < 0.72) return "Waning Gibbous";
  if (p < 0.78) return "Last Quarter";
  return "Waning Crescent";
}