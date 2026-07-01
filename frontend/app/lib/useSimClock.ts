// useSimClock.ts
// -------------------------------------------------------------------------
// The simulation clock for Artemis Navigator's time controls.
//
// Owns the simulated time and how it advances. Universe-Sandbox style:
// time always runs at the chosen rate (never auto-pauses), you can pause it
// yourself, speed it up, snap back to "now", lock it to the real system
// clock, or jump to any date.
//
// This is pure React state + requestAnimationFrame. No 3D here on purpose,
// so it can be verified on its own before the scene depends on it.
// -------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

export interface SimClock {
  /** Current simulated time. Read this every frame in the scene. */
  getTime: () => Date;
  /** Reactive snapshot for UI (updates ~4x/sec to avoid re-render spam). */
  displayTime: Date;
  paused: boolean;
  /** Seconds of sim-time per real second. 1 = real-time. */
  speed: number;
  realtime: boolean;
  setPaused: (p: boolean) => void;
  togglePaused: () => void;
  setSpeed: (s: number) => void;
  /** Snap to the real current time and follow it live. */
  goRealtime: () => void;
  /** Jump to an arbitrary instant (leaves realtime mode). */
  jumpTo: (d: Date) => void;
  /** Reset to now but stay in manual (not realtime-following) mode. */
  resetToNow: () => void;
}

// Preset speed multipliers for the UI slider (sim-seconds per real-second).
export const SPEED_PRESETS = [
  { label: "Real-time", value: 1 },
  { label: "1 min/s", value: 60 },
  { label: "1 hr/s", value: 3600 },
  { label: "6 hr/s", value: 21600 },
  { label: "1 day/s", value: 86400 },
  { label: "1 wk/s", value: 604800 },
];

export function useSimClock(): SimClock {
  // The authoritative sim time lives in a ref so the animation loop can read
  // it without causing React re-renders every frame.
  const simTimeRef = useRef<number>(Date.now()); // ms since epoch
  const lastRealRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [realtime, setRealtime] = useState(true);
  const [displayTime, setDisplayTime] = useState<Date>(new Date());

  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const realtimeRef = useRef(realtime);
  pausedRef.current = paused;
  speedRef.current = speed;
  realtimeRef.current = realtime;

  // main tick
  useEffect(() => {
    let lastDisplay = 0;
    const tick = (nowReal: number) => {
      const dtMs = nowReal - lastRealRef.current;
      lastRealRef.current = nowReal;

      if (realtimeRef.current) {
        // follow the actual wall clock exactly
        simTimeRef.current = Date.now();
      } else if (!pausedRef.current) {
        // advance sim time by real elapsed * speed
        simTimeRef.current += dtMs * speedRef.current;
      }

      // throttle the reactive display update to ~4 Hz
      if (nowReal - lastDisplay > 250) {
        lastDisplay = nowReal;
        setDisplayTime(new Date(simTimeRef.current));
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const getTime = useCallback(() => new Date(simTimeRef.current), []);

  const togglePaused = useCallback(() => setPaused((p) => !p), []);

  const goRealtime = useCallback(() => {
    setRealtime(true);
    setPaused(false);
    simTimeRef.current = Date.now();
    setDisplayTime(new Date(simTimeRef.current));
  }, []);

  const jumpTo = useCallback((d: Date) => {
    setRealtime(false);
    simTimeRef.current = d.getTime();
    setDisplayTime(new Date(simTimeRef.current));
  }, []);

  const resetToNow = useCallback(() => {
    setRealtime(false);
    simTimeRef.current = Date.now();
    setDisplayTime(new Date(simTimeRef.current));
  }, []);

  const setSpeedSafe = useCallback((s: number) => {
    setSpeed(s);
    setRealtime(false); // changing speed means we're no longer live-following
  }, []);

  const setPausedSafe = useCallback((p: boolean) => {
    setPaused(p);
    if (p) setRealtime(false);
  }, []);

  return {
    getTime,
    displayTime,
    paused,
    speed,
    realtime,
    setPaused: setPausedSafe,
    togglePaused,
    setSpeed: setSpeedSafe,
    goRealtime,
    jumpTo,
    resetToNow,
  };
}