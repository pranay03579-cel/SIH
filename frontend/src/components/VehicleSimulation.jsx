/**
 * VehicleSimulation.jsx
 * ─────────────────────
 * Pure simulation engine — manages vehicle movement state, coordinate
 * sampling, landslide placement, and progress tracking.
 *
 * Renders nothing itself. Exposes simulation state and controls
 * to parent via props/callbacks.
 *
 * State machine:
 *   idle → running → (paused ↔ running) → landslide → idle
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { normalizeCoordinates } from '../utils/geoUtils';

// ── Configuration ────────────────────────────────────────────────────────────
// Target demo duration: ~45 seconds regardless of coordinate count
const DEMO_DURATION_MS = 45_000;
// Maximum sampled waypoints for smooth animation without performance hit
const MAX_WAYPOINTS = 120;
// How far ahead the landslide appears (fraction of remaining route, 0–1)
const LANDSLIDE_AHEAD_FRACTION = 0.3;

/**
 * Down-sample a coordinate array to at most maxPoints evenly spaced points,
 * while always preserving first and last.
 */
function sampleCoords(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;
  const result = [];
  const step = (coords.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  return result;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useVehicleSimulation(selectedRoute) {
  const [simState, setSimState] = useState('idle');
  // 'idle' | 'running' | 'paused' | 'landslide'

  const [stepIndex, setStepIndex] = useState(0);
  const [waypoints, setWaypoints] = useState([]);          // sampled [lat,lon] array
  const [vehiclePos, setVehiclePos] = useState(null);      // [lat, lon]
  const [landslidePos, setLandslidePos] = useState(null);  // [lat, lon]
  const [progressPct, setProgressPct] = useState(0);

  const intervalRef = useRef(null);
  const stepIndexRef = useRef(0);   // mirror of stepIndex for use inside setInterval

  // Keep stepIndexRef in sync
  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

  // Interval duration per step
  const stepDuration = waypoints.length > 1
    ? Math.round(DEMO_DURATION_MS / (waypoints.length - 1))
    : 400;

  // ── Stop interval helper ──────────────────────────────────────────────────
  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopInterval(), [stopInterval]);

  // ── Advance a single step ─────────────────────────────────────────────────
  const advanceStep = useCallback((wps) => {
    const currentIdx = stepIndexRef.current;
    const nextIdx = currentIdx + 1;

    if (nextIdx >= wps.length) {
      // Journey complete
      stopInterval();
      setSimState('idle');
      setProgressPct(100);
      return;
    }

    stepIndexRef.current = nextIdx;
    setStepIndex(nextIdx);
    setVehiclePos(wps[nextIdx]);
    setProgressPct(Math.round((nextIdx / (wps.length - 1)) * 100));
  }, [stopInterval]);

  // ── Start interval ────────────────────────────────────────────────────────
  const startInterval = useCallback((wps) => {
    stopInterval();
    intervalRef.current = setInterval(() => advanceStep(wps), stepDuration);
  }, [stopInterval, advanceStep, stepDuration]);

  // ── PUBLIC CONTROLS ───────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (!selectedRoute?.coordinates) return;

    const rawCoords = normalizeCoordinates(selectedRoute.coordinates);
    if (rawCoords.length < 2) return;

    const wps = sampleCoords(rawCoords, MAX_WAYPOINTS);

    // Reset everything
    setWaypoints(wps);
    setStepIndex(0);
    stepIndexRef.current = 0;
    setVehiclePos(wps[0]);
    setProgressPct(0);
    setLandslidePos(null);
    setSimState('running');

    // Start moving on next tick (let state settle)
    setTimeout(() => {
      intervalRef.current = setInterval(() => advanceStep(wps), DEMO_DURATION_MS / (wps.length - 1));
    }, 50);
  }, [selectedRoute, advanceStep]);

  const pause = useCallback(() => {
    if (simState !== 'running') return;
    stopInterval();
    setSimState('paused');
  }, [simState, stopInterval]);

  const resume = useCallback(() => {
    if (simState !== 'paused') return;
    setSimState('running');
    startInterval(waypoints);
  }, [simState, waypoints, startInterval]);

  const reset = useCallback(() => {
    stopInterval();
    setSimState('idle');
    setStepIndex(0);
    stepIndexRef.current = 0;
    setVehiclePos(null);
    setLandslidePos(null);
    setProgressPct(0);
    setWaypoints([]);
  }, [stopInterval]);

  const simulateLandslide = useCallback(() => {
    if (simState !== 'running' && simState !== 'paused') return;

    stopInterval();

    // Place landslide ahead of vehicle
    const currentIdx = stepIndexRef.current;
    const aheadIdx = Math.min(
      Math.round(currentIdx + (waypoints.length - currentIdx) * LANDSLIDE_AHEAD_FRACTION),
      waypoints.length - 1
    );
    const incidentCoord = waypoints[aheadIdx] || vehiclePos;

    setLandslidePos(incidentCoord);
    setSimState('landslide');
  }, [simState, waypoints, vehiclePos, stopInterval]);

  return {
    simState,
    vehiclePos,
    landslidePos,
    progressPct,
    stepIndex,
    totalSteps: waypoints.length,
    controls: { start, pause, resume, reset, simulateLandslide },
  };
}
