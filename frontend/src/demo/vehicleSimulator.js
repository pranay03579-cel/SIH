import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PRIMARY_CORRIDOR_WAYPOINTS,
  FULL_R2_WAYPOINTS,
  SAFE_HOLDING_POINT,
  SCENARIO_1_EVENT,
  SCENARIO_2_EVENT,
} from './dataPool';
import { SIMULATION_STATES } from './disruptionEngine';

// Haversine distance between two [lat, lng] coordinates in kilometers
export function haversineDistanceKm(p1, p2) {
  if (!p1 || !p2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
  const lat1 = (p1[0] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Compute total route length along an array of coordinates
export function computeTotalDistanceKm(waypoints = []) {
  if (!waypoints || waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineDistanceKm(waypoints[i], waypoints[i + 1]);
  }
  return total;
}

// Interpolate position along waypoint path at a given fraction (0.0 to 1.0)
export function getPositionAtProgress(waypoints = [], progressFraction = 0) {
  if (!waypoints || waypoints.length === 0) return null;
  if (waypoints.length === 1 || progressFraction <= 0) return waypoints[0];
  if (progressFraction >= 1) return waypoints[waypoints.length - 1];

  const totalDist = computeTotalDistanceKm(waypoints);
  const targetDist = totalDist * Math.min(1, Math.max(0, progressFraction));

  let accumulated = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segDist = haversineDistanceKm(waypoints[i], waypoints[i + 1]);
    if (accumulated + segDist >= targetDist || i === waypoints.length - 2) {
      const segFraction = segDist > 0 ? (targetDist - accumulated) / segDist : 0;
      const lat = waypoints[i][0] + (waypoints[i + 1][0] - waypoints[i][0]) * segFraction;
      const lon = waypoints[i][1] + (waypoints[i + 1][1] - waypoints[i][1]) * segFraction;
      return [lat, lon];
    }
    accumulated += segDist;
  }
  return waypoints[waypoints.length - 1];
}

/**
 * Custom React Hook managing the deterministic MARG LIVE simulation engine.
 */
export function useLiveSimulationEngine(scenario) {
  const [simState, setSimState] = useState(SIMULATION_STATES.READY);
  const [progressPct, setProgressPct] = useState(0);
  const [vehiclePos, setVehiclePos] = useState(PRIMARY_CORRIDOR_WAYPOINTS[0]);
  const [activeCorridorId, setActiveCorridorId] = useState('R1');
  const [activeWaypoints, setActiveWaypoints] = useState(PRIMARY_CORRIDOR_WAYPOINTS);
  const [incidentActive, setIncidentActive] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);
  const analysisTimerRef = useRef(null);
  const decisionTimerRef = useRef(null);

  // Clear all background timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    if (decisionTimerRef.current) clearTimeout(decisionTimerRef.current);
  }, []);

  // Reset function returning everything safely to READY
  const resetSimulation = useCallback(() => {
    clearTimers();
    setSimState(SIMULATION_STATES.READY);
    setProgressPct(0);
    setVehiclePos(PRIMARY_CORRIDOR_WAYPOINTS[0]);
    setActiveCorridorId('R1');
    setActiveWaypoints(PRIMARY_CORRIDOR_WAYPOINTS);
    setIncidentActive(false);
    setAnalysisStep(0);
    setIsPaused(false);
  }, [clearTimers]);

  // Start simulation handler
  const startSimulation = useCallback(() => {
    if (simState === SIMULATION_STATES.READY) {
      setSimState(SIMULATION_STATES.MONITORING);
      setIsPaused(false);
    }
  }, [simState]);

  // Pause handler
  const pauseSimulation = useCallback(() => {
    setIsPaused(true);
  }, []);

  // Resume handler
  const resumeSimulation = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Movement loop for MONITORING state
  useEffect(() => {
    if (simState === SIMULATION_STATES.MONITORING && !isPaused) {
      const triggerPoint = scenario?.triggerProgressPct || 35;

      timerRef.current = setInterval(() => {
        setProgressPct((prev) => {
          const next = prev + 1.2;

          // Check if trigger point reached for active scenario
          if ((scenario?.type === 'LANDSLIDE' || scenario?.type === 'FLOODING') && next >= triggerPoint) {
            clearInterval(timerRef.current);
            // Lock position at exact trigger point
            const triggerPos = getPositionAtProgress(PRIMARY_CORRIDOR_WAYPOINTS, triggerPoint / 100);
            setVehiclePos(triggerPos);
            setIncidentActive(true);
            setSimState(SIMULATION_STATES.DISRUPTION_DETECTED);
            return triggerPoint;
          }

          // Normal progression
          const pos = getPositionAtProgress(PRIMARY_CORRIDOR_WAYPOINTS, Math.min(100, next) / 100);
          setVehiclePos(pos);

          if (next >= 100) {
            clearInterval(timerRef.current);
            setSimState(SIMULATION_STATES.MISSION_COMPLETE);
            return 100;
          }

          return next;
        });
      }, 200);

      return () => clearInterval(timerRef.current);
    }
  }, [simState, isPaused, scenario]);

  // Automatic transition from DISRUPTION_DETECTED -> ANALYZING
  useEffect(() => {
    if (simState === SIMULATION_STATES.DISRUPTION_DETECTED) {
      analysisTimerRef.current = setTimeout(() => {
        setSimState(SIMULATION_STATES.ANALYZING);
        setAnalysisStep(1);
      }, 1800);

      return () => clearTimeout(analysisTimerRef.current);
    }
  }, [simState]);

  // Sequential Analysis Step Progression in ANALYZING state
  useEffect(() => {
    if (simState === SIMULATION_STATES.ANALYZING) {
      const steps = scenario?.eventConfig?.analysis_steps || SCENARIO_1_EVENT.analysis_steps;
      const maxSteps = steps.length;

      const stepInterval = setInterval(() => {
        setAnalysisStep((prev) => {
          if (prev < maxSteps) {
            return prev + 1;
          }
          clearInterval(stepInterval);

          // Branch depending on scenario
          if (scenario?.id === 'scenario_2_flooding' || scenario?.hasSafeAlternative === false) {
            // Scenario 2: Transition to NO_SAFE_ROUTE
            setTimeout(() => {
              setSimState(SIMULATION_STATES.NO_SAFE_ROUTE);
            }, 800);
          } else {
            // Scenario 1: Transition to REROUTING
            setTimeout(() => {
              setSimState(SIMULATION_STATES.REROUTING);
            }, 800);
          }

          return prev;
        });
      }, 700);

      return () => clearInterval(stepInterval);
    }
  }, [simState, scenario]);

  // SCENARIO 1: Transition from REROUTING -> REROUTED and switch to Corridor R2
  useEffect(() => {
    if (simState === SIMULATION_STATES.REROUTING) {
      const rerouteTimer = setTimeout(() => {
        setActiveCorridorId('R2');
        setActiveWaypoints(FULL_R2_WAYPOINTS);
        setSimState(SIMULATION_STATES.REROUTED);
        // Vehicle starts on R2 from junction (~35% of R2)
        setProgressPct(35);
      }, 1600);

      return () => clearTimeout(rerouteTimer);
    }
  }, [simState]);

  // SCENARIO 1: Movement loop for REROUTED state along Alternative Corridor R2
  useEffect(() => {
    if (simState === SIMULATION_STATES.REROUTED && !isPaused) {
      timerRef.current = setInterval(() => {
        setProgressPct((prev) => {
          const next = prev + 1.2;
          const pos = getPositionAtProgress(FULL_R2_WAYPOINTS, Math.min(100, next) / 100);
          setVehiclePos(pos);

          if (next >= 100) {
            clearInterval(timerRef.current);
            setSimState(SIMULATION_STATES.MISSION_COMPLETE);
            return 100;
          }

          return next;
        });
      }, 200);

      return () => clearInterval(timerRef.current);
    }
  }, [simState, isPaused]);

  // SCENARIO 2: Transition from NO_SAFE_ROUTE -> RETURNING_TO_SAFE_POINT
  useEffect(() => {
    if (simState === SIMULATION_STATES.NO_SAFE_ROUTE) {
      decisionTimerRef.current = setTimeout(() => {
        setSimState(SIMULATION_STATES.RETURNING_TO_SAFE_POINT);
      }, 2400);

      return () => clearTimeout(decisionTimerRef.current);
    }
  }, [simState]);

  // SCENARIO 2: Vehicle Return Movement loop (moving backward along R1 to Jowai Safe Holding Depot)
  useEffect(() => {
    if (simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT && !isPaused) {
      const safePointProgress = SAFE_HOLDING_POINT.progressPct || 28;

      timerRef.current = setInterval(() => {
        setProgressPct((prev) => {
          const next = prev - 1.1; // Smoothly step backward along the traveled route

          if (next <= safePointProgress) {
            clearInterval(timerRef.current);
            setVehiclePos(SAFE_HOLDING_POINT.coords);
            setSimState(SIMULATION_STATES.SAFE_HOLDING);
            return safePointProgress;
          }

          const pos = getPositionAtProgress(PRIMARY_CORRIDOR_WAYPOINTS, next / 100);
          setVehiclePos(pos);
          return next;
        });
      }, 200);

      return () => clearInterval(timerRef.current);
    }
  }, [simState, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Calculate retreat progress (0% to 100%) during safety return
  const triggerPoint = scenario?.triggerProgressPct || 48;
  const safePointProgress = SAFE_HOLDING_POINT.progressPct || 28;
  let retreatProgressPct = 0;
  if (simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT) {
    retreatProgressPct = Math.round(
      Math.min(100, Math.max(0, ((triggerPoint - progressPct) / (triggerPoint - safePointProgress)) * 100))
    );
  } else if (simState === SIMULATION_STATES.SAFE_HOLDING) {
    retreatProgressPct = 100;
  }

  // Active milestone for Scenario 3
  const isNominal = scenario?.type === 'NOMINAL';
  const milestones = scenario?.eventConfig?.milestones || [];
  let currentMilestone = null;
  if (isNominal && simState !== SIMULATION_STATES.READY) {
    if (progressPct >= 100 || simState === SIMULATION_STATES.MISSION_COMPLETE) {
      currentMilestone = milestones[3] || milestones[milestones.length - 1];
    } else if (progressPct >= 75) {
      currentMilestone = milestones[2];
    } else if (progressPct >= 50) {
      currentMilestone = milestones[1];
    } else if (progressPct >= 25) {
      currentMilestone = milestones[0];
    }
  }

  return {
    simState,
    progressPct: Math.round(progressPct),
    retreatProgressPct,
    currentMilestone,
    vehiclePos,
    activeCorridorId,
    activeWaypoints,
    incidentActive,
    analysisStep,
    isPaused,
    controls: {
      start: startSimulation,
      pause: pauseSimulation,
      resume: resumeSimulation,
      reset: resetSimulation,
    },
  };
}
