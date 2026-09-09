/**
 * MARG LIVE Disruption State Engine
 * Manages simulation lifecycle states, telemetry channels, and transition logic.
 */

export const SIMULATION_STATES = {
  READY: 'READY',
  MONITORING: 'MONITORING',
  DISRUPTION_DETECTED: 'DISRUPTION_DETECTED',
  ANALYZING: 'ANALYZING',
  REROUTING: 'REROUTING',
  CONTINUE: 'CONTINUE',
  REROUTED: 'REROUTED',
  NO_SAFE_ROUTE: 'NO_SAFE_ROUTE',
  RETURNING_TO_SAFE_POINT: 'RETURNING_TO_SAFE_POINT',
  SAFE_HOLDING: 'SAFE_HOLDING',
  MISSION_COMPLETE: 'MISSION_COMPLETE',
};

export const STATE_METADATA = {
  [SIMULATION_STATES.READY]: {
    label: 'READY',
    badgeText: 'SYSTEM READY',
    color: 'var(--forest-green)',
    bg: 'var(--sage-light)',
    border: 'var(--sage-accent)',
    description: 'System calibrated. Select a scenario and start the live simulation demo.',
    statusSummary: 'READY FOR MISSION DISPATCH',
  },
  [SIMULATION_STATES.MONITORING]: {
    label: 'MONITORING',
    badgeText: 'SIMULATED MONITORING ACTIVE',
    color: '#0284c7',
    bg: '#e0f2fe',
    border: '#7dd3fc',
    description: 'Vehicle in transit along active corridor. Simulated telemetry stream continuously active.',
    statusSummary: 'MONITORING ROUTE CONDITIONS',
  },
  [SIMULATION_STATES.DISRUPTION_DETECTED]: {
    label: 'DISRUPTION_DETECTED',
    badgeText: 'DISRUPTION DETECTED',
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
    description: 'Hazard detected ahead on corridor R1. Transport vehicle holding position safely.',
    statusSummary: 'HAZARD DETECTED AHEAD · VEHICLE STOPPED SAFELY',
  },
  [SIMULATION_STATES.ANALYZING]: {
    label: 'ANALYZING',
    badgeText: 'ROUTE IMPACT ANALYSIS',
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fcd34d',
    description: 'MARG Multi-Hazard Decision Engine evaluating candidate diversion corridors & vehicle safety.',
    statusSummary: 'EVALUATING ALTERNATIVE CORRIDORS & WATER LEVELS',
  },
  [SIMULATION_STATES.REROUTING]: {
    label: 'REROUTING',
    badgeText: 'AUTOMATIC REROUTE APPROVED',
    color: '#7c3aed',
    bg: '#f3e8ff',
    border: '#d8b4fe',
    description: 'Alternative Corridor R2 approved. Telemetry routing instructions pushed to vehicle.',
    statusSummary: 'DISPATCHING TO SAFE ALTERNATIVE R2',
  },
  [SIMULATION_STATES.REROUTED]: {
    label: 'REROUTED',
    badgeText: 'MONITORING CONTINUES · R2 ACTIVE',
    color: '#0d9488',
    bg: '#ccfbf1',
    border: '#5eead4',
    description: 'Vehicle progressing safely along verified Haflong Bypass corridor (R2).',
    statusSummary: 'TRANSIT CONTINUES ON ALTERNATIVE CORRIDOR R2',
  },
  [SIMULATION_STATES.NO_SAFE_ROUTE]: {
    label: 'NO_SAFE_ROUTE',
    badgeText: 'NO SAFE ALTERNATIVE AVAILABLE',
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
    description: 'All forward corridors exceed critical hazard thresholds. MARG initiates vehicle retreat protocol.',
    statusSummary: 'ALL CORRIDORS UNSAFE · RETURN DIRECTIVE ISSUED',
  },
  [SIMULATION_STATES.RETURNING_TO_SAFE_POINT]: {
    label: 'RETURNING_TO_SAFE_POINT',
    badgeText: 'RETURNING TO SAFE POINT',
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fcd34d',
    description: 'Vehicle executing controlled tactical retreat to Jowai Emergency Staging Depot.',
    statusSummary: 'RETREAT IN PROGRESS TOWARDS SAFE DEPOT',
  },
  [SIMULATION_STATES.SAFE_HOLDING]: {
    label: 'SAFE_HOLDING',
    badgeText: 'VEHICLE SECURED AT SAFE POINT',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    description: 'Vehicle safely parked at Jowai Emergency Staging Depot. Mission paused for driver & cargo protection.',
    statusSummary: 'VEHICLE SECURED AT SAFE HOLDING POINT',
  },
  [SIMULATION_STATES.MISSION_COMPLETE]: {
    label: 'MISSION_COMPLETE',
    badgeText: 'MISSION COMPLETE · ARRIVED',
    color: 'var(--forest-green)',
    bg: 'var(--sage-light)',
    border: 'var(--sage-accent)',
    description: 'Vehicle successfully reached destination Silchar Logistics Depot with zero hazard exposure.',
    statusSummary: 'TRANSIT COMPLETED SAFELY AT DESTINATION',
  },
};

export function getMonitoringChannels(simState = SIMULATION_STATES.READY, scenario = null) {
  const isMoving = simState === SIMULATION_STATES.MONITORING || simState === SIMULATION_STATES.REROUTED;
  const isAlert =
    simState === SIMULATION_STATES.DISRUPTION_DETECTED ||
    simState === SIMULATION_STATES.ANALYZING ||
    simState === SIMULATION_STATES.NO_SAFE_ROUTE;
  const isReturning = simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT;
  const isSecured = simState === SIMULATION_STATES.SAFE_HOLDING;
  const isMissionComplete = simState === SIMULATION_STATES.MISSION_COMPLETE;

  const isFlooding = scenario?.type === 'FLOODING';
  const isNominal = scenario?.type === 'NOMINAL';

  if (isNominal) {
    return [
      {
        id: 'terrain_hazards',
        name: 'Terrain Hazards',
        status: isMissionComplete ? 'NORMAL' : (isMoving ? 'NORMAL' : 'READY'),
        statusClass: isMissionComplete ? 'nominal' : (isMoving ? 'active' : 'nominal'),
        subtext: isMissionComplete
          ? 'Zero hazard incidents recorded throughout 301.8 km corridor'
          : 'Monitoring slope and landslide indicators (Nominal stability)',
      },
      {
        id: 'weather_conditions',
        name: 'Weather Conditions',
        status: isMissionComplete ? 'STABLE' : (isMoving ? 'STABLE' : 'READY'),
        statusClass: isMissionComplete ? 'nominal' : (isMoving ? 'active' : 'nominal'),
        subtext: isMissionComplete
          ? 'Clear environmental conditions maintained across all sectors'
          : 'Precipitation 2.4 mm/h · Visibility > 10 km · No storm activity',
      },
      {
        id: 'road_disruption_feed',
        name: 'Road Disruption Feed',
        status: isMissionComplete ? 'CLEAR' : (isMoving ? 'CLEAR' : 'READY'),
        statusClass: isMissionComplete ? 'nominal' : (isMoving ? 'active' : 'nominal'),
        subtext: isMissionComplete
          ? 'NH-27 / NH-6 corridor verified clear and unobstructed'
          : 'No active road closures or traffic obstructions reported',
      },
      {
        id: 'vehicle_position',
        name: 'Vehicle Status & Position',
        status: isMissionComplete
          ? 'ARRIVED AT DESTINATION'
          : (isMoving ? 'IN TRANSIT' : 'READY'),
        statusClass: isMissionComplete ? 'nominal' : (isMoving ? 'active' : 'nominal'),
        subtext: isMissionComplete
          ? 'Staged safely at Silchar Distribution Depot'
          : 'Tracking corridor progress along primary route (45 km/h)',
      },
    ];
  }

  return [
    {
      id: 'terrain_hazards',
      name: isFlooding ? 'Hydrological & Inundation' : 'Terrain Hazards',
      status: isAlert || isReturning || isSecured
        ? (isFlooding ? 'CRITICAL FLOOD SURGE' : 'DISRUPTION DETECTED')
        : (isMoving ? 'MONITORING' : 'READY'),
      statusClass: isAlert || isReturning || isSecured ? 'warning' : (isMoving ? 'active' : 'nominal'),
      subtext: isFlooding
        ? (isAlert || isReturning || isSecured ? 'Water depth 1.8m at Sonapur Basin' : 'Flood risk assessment synced')
        : (isAlert ? 'Slope failure alert at Km 142' : 'Landslide ML risk model synced'),
    },
    {
      id: 'weather_conditions',
      name: 'Weather Conditions',
      status: isMoving || isAlert || isReturning || isSecured ? (isFlooding ? 'TORRENTIAL RAINFALL' : 'MONITORING') : 'READY',
      statusClass: isFlooding && (isAlert || isReturning || isSecured) ? 'warning' : (isMoving || isAlert ? 'active' : 'nominal'),
      subtext: isFlooding ? 'Precipitation 112mm/hr · Flash flood warning' : 'Open-Meteo precipitation stream active',
    },
    {
      id: 'road_disruption_feed',
      name: 'Road Disruption Feed',
      status: isSecured
        ? 'ALL CORRIDORS CLOSED'
        : (isAlert || isReturning ? (isFlooding ? 'PRIMARY & R2 INUNDATED' : 'OBSTRUCTION ACTIVE') : (isMoving ? 'MONITORING' : 'READY')),
      statusClass: isAlert || isReturning || isSecured ? 'warning' : (isMoving ? 'active' : 'nominal'),
      subtext: isFlooding
        ? (isAlert || isReturning || isSecured ? 'NH-6 Km 185 submerged · Haflong bypass blocked' : 'Waterlogging sensor telemetry listening')
        : (isAlert ? 'Highway blocked at Lad Rymbai' : 'GIS obstacle telemetry stream listening'),
    },
    {
      id: 'vehicle_position',
      name: 'Vehicle Status & Position',
      status: isSecured
        ? 'SECURED AT SAFE DEPOT'
        : (isReturning
          ? 'RETURNING TO SAFE POINT'
          : (isAlert ? 'HOLDING POSITION' : (isMoving ? 'TRACKING' : 'READY'))),
      statusClass: isSecured ? 'nominal' : (isReturning ? 'active' : (isAlert ? 'warning' : (isMoving ? 'active' : 'nominal'))),
      subtext: isSecured
        ? 'Staged at Jowai Depot (Zero hazard exposure)'
        : (isReturning
          ? 'Tactical retreat at 40 km/h towards Jowai Depot'
          : (isMoving ? 'GPS telemetry stream active (45 km/h)' : 'GPS coordinate calibrated')),
    },
  ];
}
