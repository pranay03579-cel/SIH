/**
 * MARG LIVE Data Pool
 * Defines mission profiles, GIS waypoint tracks, scenario configurations, and event triggers.
 */

// Primary corridor track: Guwahati (NH-27) -> Shillong -> Jowai (NH-6) -> Silchar (301.8 km)
export const PRIMARY_CORRIDOR_WAYPOINTS = [
  [26.1445, 91.7362], // Guwahati Hub [A] (Km 0)
  [26.0950, 91.7820], // Khanapara Junction (Km 12)
  [26.0120, 91.8340], // Burnihat Border (Km 28)
  [25.9300, 91.8650], // Nongpoh Valley (Km 48)
  [25.8200, 91.8890], // Umsning Ascent (Km 72)
  [25.6800, 91.9120], // Umiam Lake Overlook (Km 88)
  [25.5788, 91.8933], // Shillong Gateway (Km 100)
  [25.5320, 92.0120], // Mawryngkneng Bypass Junction (Km 118)
  [25.4450, 92.1850], // Jowai Ridge (Km 132)
  [25.4050, 92.3500], // Lad Rymbai (Incident point in Scenario 1 - Km 142)
  [25.2980, 92.4820], // Khliehriat Mountain Pass (Km 170)
  [25.1850, 92.5920], // Sonapur Tunnel Approach (Km 195)
  [25.0820, 92.6840], // Meghalaya-Assam Border (Km 225)
  [24.9750, 92.7420], // Kalain Plains (Km 255)
  [24.8920, 92.7650], // Badarpur Link (Km 280)
  [24.8333, 92.7789], // Silchar Logistics Hub [B] (Km 301.8)
];

// Full Alternative Corridor R2 track: Guwahati -> Shillong -> Mawryngkneng -> Haflong -> Silchar (324.5 km)
export const FULL_R2_WAYPOINTS = [
  [26.1445, 91.7362], // Guwahati Hub [A]
  [26.0950, 91.7820], // Khanapara Junction
  [26.0120, 91.8340], // Burnihat Border
  [25.9300, 91.8650], // Nongpoh Valley
  [25.8200, 91.8890], // Umsning Ascent
  [25.6800, 91.9120], // Umiam Lake Overlook
  [25.5788, 91.8933], // Shillong Gateway
  [25.5320, 92.0120], // Mawryngkneng Junction (Reroute branching point)
  [25.6120, 92.3200], // Umrangso Access
  [25.5200, 92.7100], // North Cachar Hills Transit
  [25.1800, 92.9800], // Haflong Secure Bypass
  [24.9500, 92.8900], // Jatinga Valley Safe Corridor
  [24.8333, 92.7789], // Silchar Hub [B]
];

// Diversion branch only (from Mawryngkneng to Silchar)
export const ALTERNATIVE_DIVERSION_BRANCH = [
  [25.5320, 92.0120], // Mawryngkneng Junction
  [25.6120, 92.3200], // Umrangso Access
  [25.5200, 92.7100], // North Cachar Hills Transit
  [25.1800, 92.9800], // Haflong Secure Bypass
  [24.9500, 92.8900], // Jatinga Valley Safe Corridor
  [24.8333, 92.7789], // Silchar Hub [B]
];

// Nearest emergency holding & depot facility for Scenario 2 (Return to Safe Point)
export const SAFE_HOLDING_POINT = {
  id: 'SAFE-01',
  name: 'Jowai Emergency Staging & Holding Depot',
  city: 'Jowai, Meghalaya',
  coords: [25.4450, 92.1850], // Waypoint index 8 along R1 (~28% progress, behind 48% flood point)
  capacity: 'Available (Level 1 Facility)',
  amenities: 'Heavy Vehicle Staging, Fuel Reserves, Structural Shelter, Telemetry Relay',
  progressPct: 28,
};

// Scenario 1 Controlled Disruption Event Definition
export const SCENARIO_1_EVENT = {
  id: 'LANDSLIDE_SCENARIO_01',
  type: 'LANDSLIDE',
  severity: 'HIGH',
  status: 'ACTIVE',
  trigger_at_progress: 35, // Trigger when vehicle reaches 35% of journey
  trigger_waypoint_index: 7, // Around Mawryngkneng junction
  affected_route: 'R1',
  affected_route_name: 'NH-27 / NH-6 Primary Corridor',
  incident_location: [25.4050, 92.3500],
  incident_name: 'Lad Rymbai Mountain Sector (NH-6 Km 142)',
  alternative_route: 'R2',
  alternative_route_name: 'Haflong Secure Bypass Corridor',
  alternative_available: true,
  description: 'Terrain disruption (rockfall & slope failure) detected ahead on the active corridor at Km 142.',
  safety_assessment: 'Disruption detected ahead of the vehicle. Immediate route analysis initiated.',
  analysis_steps: [
    'Disruption confirmed: Lad Rymbai Mountain Sector (NH-6 Km 142)',
    'Active corridor [R1] compromised — Road fully blocked ahead',
    'Vehicle position verified (Km 118 / Safe Distance: 24.0 km before hazard zone)',
    'Evaluating candidate corridor [R2] via Haflong Secure Bypass...',
    'Alternative corridor [R2] verified safe (Multi-Hazard Index: 36.2% · Suitable for TRUCK)',
  ],
  reroute_decision: {
    current_corridor: 'R1 — COMPROMISED',
    new_corridor: 'R2 — ALTERNATIVE AVAILABLE',
    decision: 'AUTOMATIC REROUTE APPROVED',
    reason: 'Corridor R2 completely bypasses Lad Rymbai incident zone with optimal accessibility score.',
  },
};

// Scenario 2 Controlled Critical Flooding Event Definition (No Safe Alternative)
export const SCENARIO_2_EVENT = {
  id: 'S2-FLOOD-001',
  type: 'CRITICAL FLOODING',
  severity: 'CRITICAL',
  status: 'ACTIVE',
  trigger_at_progress: 48, // Trigger when vehicle reaches 48% along R1 (past Jowai at Sonapur Approach)
  trigger_waypoint_index: 9,
  affected_routes: ['R1', 'R2'],
  affected_route_names: 'NH-6 Sonapur Valley & Haflong Bypass Basin',
  incident_location: [25.1850, 92.5920],
  incident_name: 'Sonapur Valley & Lubha River Inundation (NH-6 Km 185)',
  safe_holding_point: SAFE_HOLDING_POINT,
  has_safe_alternative: false,
  description: 'Critical flooding and river breach detected ahead. Primary corridor R1 and alternative corridor R2 are completely impassable.',
  safety_assessment: 'Critical flooding detected ahead. All forward corridors unsafe. Immediate vehicle safety retreat initiated.',
  analysis_steps: [
    'Flood event verified: Sonapur Valley & Lubha River Basin (Water depth > 1.8m)',
    'Primary corridor [R1] impact assessed: Sonapur mountain tunnel approach submerged',
    'Alternative corridor [R2] evaluated: Haflong bypass inundated at Jatinga basin',
    'Vehicle compatibility checked: 16T Heavy Transport clearance threshold exceeded',
    'Safe route availability determined: ZERO safe forward corridors available',
  ],
  decision: {
    title: 'MARG SAFETY DECISION',
    headline: 'NO SAFE FORWARD CORRIDOR AVAILABLE',
    primary_status: 'R1 — COMPROMISED (SUBMERGED)',
    alternative_status: 'R2 — UNSAFE (BASIN FLOODED)',
    action: 'RETURN TO SAFE POINT',
    safe_point_name: 'Jowai Emergency Staging & Holding Depot (Km 132)',
    reason: 'Continuing forward or forcing an alternate reroute would expose the transport vehicle to catastrophic flood immersion. MARG directs an immediate tactical retreat to the nearest predefined safe holding facility.',
    disclaimer: 'PROTOTYPE SIMULATION DECISION — Autonomous Driver Safety Protocol',
  },
};

// Scenario 3 Nominal / Normal Journey Configuration
export const SCENARIO_3_CONFIG = {
  id: 'scenario_3_nominal',
  name: 'Normal Journey · Continuous Monitoring',
  description: 'Continuous multi-hazard telemetry scanning with zero critical disruption detected.',
  event: null,
  has_safe_alternative: null,
  outcome: 'MISSION_COMPLETE',
  milestones: [
    {
      progressPct: 25,
      title: 'CHECKPOINT 1 VERIFIED · Umiam Valley (Km 75)',
      description: 'Slope stability indicators nominal · Precipitation 2.4 mm/h (Safe threshold: < 25 mm/h)',
    },
    {
      progressPct: 50,
      title: 'MID-CORRIDOR STATUS · Jowai Transit Ridge (Km 150)',
      description: 'Mountain pass clear · Waterlogging index: 0.0% · No road obstructions detected',
    },
    {
      progressPct: 75,
      title: 'FINAL CORRIDOR CHECK · Sonapur Valley (Km 225)',
      description: 'Bridge structural sensors nominal · Continuous telemetry confirmed clear path',
    },
    {
      progressPct: 100,
      title: 'DESTINATION ARRIVAL · Silchar Depot (Km 301.8)',
      description: 'Vehicle arrived safely · Zero hazard exposure recorded throughout the journey',
    },
  ],
  completion: {
    title: 'MISSION COMPLETED SAFELY',
    destination: 'Silchar Distribution Depot',
    route: 'R1 — PRIMARY LOGISTICS CORRIDOR (NH-27 / NH-6)',
    distanceKm: 301.8,
    outcome: 'NO CRITICAL ROUTE DISRUPTION DETECTED',
    summary:
      'MARG LIVE continuously monitored terrain hazards, weather conditions, road disruptions, and vehicle positioning throughout the 301.8 km mountain corridor. All telemetry parameters remained strictly within safe operational limits.',
    disclaimer: 'PROTOTYPE SIMULATION COMPLETED — Demonstrating Continuous Real-Time Monitoring',
  },
};

export const DEMO_SCENARIOS = [
  {
    id: 'scenario_1_landslide',
    title: 'Scenario 1: Landslide Disruption · Safe Alternative Available',
    shortLabel: 'Landslide Disruption',
    type: 'LANDSLIDE',
    hazardLevel: 'HIGH',
    triggerDistanceKm: 142.0,
    triggerProgressPct: 35,
    incidentCoords: [25.4050, 92.3500],
    incidentName: 'Lad Rymbai Mountain Sector (NH-6 Km 142)',
    description:
      'Continuous precipitation triggers active slope failure, completely blocking the primary corridor. MARG detects the hazard, calculates risk on alternative routes, and initiates an automatic reroute.',
    expectedOutcome: 'Safe Alternative Available → Automatic Reroute',
    outcomeType: 'AUTOMATIC_REROUTE',
    hasSafeAlternative: true,
    eventConfig: SCENARIO_1_EVENT,
  },
  {
    id: 'scenario_2_flooding',
    title: 'Scenario 2: Critical Flooding · No Safe Alternative',
    shortLabel: 'Critical Flooding',
    type: 'FLOODING',
    hazardLevel: 'CRITICAL',
    triggerDistanceKm: 185.0,
    triggerProgressPct: 48,
    incidentCoords: [25.1850, 92.5920],
    incidentName: 'Sonapur Valley Inundation (NH-6 Km 185)',
    description:
      'A critical disruption affects both the primary corridor and available alternatives. MARG determines that continuing is unsafe and directs the vehicle to a predefined safe holding point.',
    expectedOutcome: 'No Safe Alternative → Return to Safe Point',
    outcomeType: 'RETURN_TO_SAFE_POINT',
    hasSafeAlternative: false,
    eventConfig: SCENARIO_2_EVENT,
  },
  {
    id: 'scenario_3_nominal',
    title: 'Scenario 3: Normal Journey · Continuous Monitoring',
    shortLabel: 'Nominal Transit',
    type: 'NOMINAL',
    hazardLevel: 'LOW',
    triggerDistanceKm: null,
    triggerProgressPct: null,
    incidentCoords: null,
    incidentName: 'No Disruptions',
    description:
      'Standard logistics transit under nominal environmental conditions. Continuous AI telemetry monitors slope stability and rainfall without disruption.',
    expectedOutcome: 'Continuous Monitoring → Mission Complete',
    outcomeType: 'MISSION_COMPLETE',
    hasSafeAlternative: null,
    eventConfig: SCENARIO_3_CONFIG,
  },
];

export const INITIAL_MISSION_DATA = {
  missionId: 'MSN-NE-8824',
  origin: {
    name: 'Guwahati Logistics Hub',
    city: 'Guwahati, Assam',
    coords: [26.1445, 91.7362],
  },
  destination: {
    name: 'Silchar Distribution Depot',
    city: 'Silchar, Assam',
    coords: [24.8333, 92.7789],
  },
  vehicle: {
    type: 'TRUCK',
    name: 'Heavy Logistics Transport (16T)',
    speedKmph: 45,
    payload: 'Emergency Medical & Food Supplies',
  },
  corridor: {
    id: 'R1',
    name: 'NH-27 / NH-6 Primary Logistics Corridor',
    distanceKm: 301.8,
    estimatedTimeMin: 223,
    baselineHazard: 45.88,
  },
  monitoringStatus: 'READY',
  missionStatus: 'READY',
};
