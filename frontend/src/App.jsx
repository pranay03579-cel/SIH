import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SidebarNav from './components/SidebarNav';
import HomeScreen from './components/HomeScreen';
import SearchSection from './components/SearchSection';
import RouteMap from './components/RouteMap';
import RouteCard from './components/RouteCard';
import { EmptyState, LoadingState, ErrorState } from './components/StateViews';
import AIRecommendationPanel from './components/AIRecommendationPanel';
import DecisionIntelligencePanel from './components/DecisionIntelligencePanel';
import RiskIntelligenceView from './components/RiskIntelligenceView';
import CompareCorridorsView from './components/CompareCorridorsView';
import { useVehicleSimulation } from './components/VehicleSimulation';
import DemoControlButton from './components/DemoControlButton';
import EmergencyRoutePanel from './components/EmergencyRoutePanel';
import { IconMap, IconBarChart } from './components/Icons';

// Helper to compute comparative badges across routes
const getComparisonTags = (route, allRoutes) => {
  if (!allRoutes || allRoutes.length <= 1) return [];
  const tags = [];
  const minDist = Math.min(...allRoutes.map(r => r.distance_km ?? Infinity));
  const minTime = Math.min(...allRoutes.map(r => r.estimated_time_min ?? Infinity));
  const minRisk = Math.min(...allRoutes.map(r => r.landslide_risk ?? Infinity));
  const maxScore = Math.max(...allRoutes.map(r => r.accessibility_score ?? -Infinity));

  if (route.distance_km === minDist) tags.push({ label: 'Shortest', type: 'distance' });
  if (route.estimated_time_min === minTime) tags.push({ label: 'Fastest', type: 'time' });
  if (route.landslide_risk === minRisk) tags.push({ label: 'Safest', type: 'risk' });
  if (route.accessibility_score === maxScore) tags.push({ label: 'Top Score', type: 'score' });

  return tags;
};

export default function App() {
  // Navigation active tab: 'home' | 'planner' | 'map' | 'decision' | 'risk' | 'compare'
  const [activeNav, setActiveNav] = useState('home');

  // Application data view states: 'empty' | 'loading' | 'error' | 'results'
  const [viewState, setViewState] = useState('empty');
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [recommendedId, setRecommendedId] = useState(null);
  const [backendRecId, setBackendRecId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [backendConnected, setBackendConnected] = useState(false);
  const [queryUrgency, setQueryUrgency] = useState('MEDIUM');

  // Vehicle simulation hook
  const sim = useVehicleSimulation(selectedRoute);

  // Emergency rerouting state
  const [emergencyRoutes, setEmergencyRoutes] = useState([]);
  const [emergencyRecommendedId, setEmergencyRecommendedId] = useState(null);
  const [emergencySelectedRoute, setEmergencySelectedRoute] = useState(null);
  const [rerouteLoading, setRerouteLoading] = useState(false);
  const [rerouteError, setRerouteError] = useState(null);
  const [blockedRouteId, setBlockedRouteId] = useState(null);

  // Backend health check on mount
  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      try {
        const res = await fetch('/health');
        if (res.ok && isMounted) setBackendConnected(true);
      } catch {
        try {
          const fallbackRes = await fetch('http://localhost:8000/');
          if (fallbackRes.ok && isMounted) setBackendConnected(true);
        } catch {
          if (isMounted) setBackendConnected(false);
        }
      }
    };
    checkBackend();
    const timer = setInterval(checkBackend, 12000);
    return () => { isMounted = false; clearInterval(timer); };
  }, []);

  // Search handler: fetches routes from /recommend-route
  const handleSearch = async ({ origin, destination, urgency }) => {
    setViewState('loading');
    setSelectedRoute(null);
    setRecommendedId(null);
    setBackendRecId(null);
    setErrorMessage('');
    const normalizedUrgency = (urgency || 'MEDIUM').toUpperCase();
    setQueryUrgency(normalizedUrgency);

    // Reset any running simulation
    sim.controls.reset();
    setEmergencyRoutes([]);
    setEmergencyRecommendedId(null);
    setEmergencySelectedRoute(null);
    setRerouteError(null);
    setBlockedRouteId(null);

    // Switch view to map/evaluation immediately to show loading on map
    setActiveNav('map');

    const payload = {
      origin: origin.trim(),
      destination: destination.trim(),
      urgency: normalizedUrgency
    };

    try {
      const response = await fetch('/recommend-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = `Server responded with HTTP ${response.status}`;
        if (typeof errorData.detail === 'string') {
          message = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          message = errorData.detail.map(d => d.msg || JSON.stringify(d)).join(' | ');
        }
        setErrorMessage(message);
        setViewState('error');
        return;
      }

      const data = await response.json();
      setBackendConnected(true);

      const returnedRoutes = Array.isArray(data.routes) ? data.routes : [];

      if (returnedRoutes.length === 0) {
        setErrorMessage(`No viable transport corridors found between '${origin}' and '${destination}'.`);
        setViewState('error');
        return;
      }

      setRoutes(returnedRoutes);
      const recId = data.recommended_route_id || returnedRoutes[0]?.route_id || null;
      setBackendRecId(recId);
      setRecommendedId(recId);
      const bestRoute = returnedRoutes.find(r => r.route_id === recId) || returnedRoutes[0];
      setSelectedRoute(bestRoute || null);
      setViewState('results');
      // Remain on the Route Results view (Map & Corridor Cards)
      setActiveNav('map');
    } catch (err) {
      console.error('Backend integration error:', err);
      setErrorMessage(`Failed to communicate with MARG backend: ${err.message}. Ensure FastAPI is active on port 8000.`);
      setViewState('error');
    }
  };

  // AI Recommendation / Analyse Corridors handler
  const handleRecommend = () => {
    if (!routes.length) return;

    let winner = routes.find(r => r.route_id === (recommendedId || backendRecId));
    if (!winner) {
      winner = routes.reduce((best, r) =>
        (r.accessibility_score > (best?.accessibility_score ?? -Infinity)) ? r : best
      , null);
    }
    if (winner) {
      setRecommendedId(winner.route_id);
      setSelectedRoute(winner);
    }
    // Navigate to Decision Intelligence / Analysis view and scroll to top
    setActiveNav('decision');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetry = () => {
    setViewState('empty');
    setActiveNav('planner');
    setRecommendedId(null);
    setBackendRecId(null);
    setErrorMessage('');
  };

  // Emergency rerouting handler
  const handleReroute = async () => {
    const vPos = sim.vehiclePos;
    const lPos = sim.landslidePos;
    if (!vPos || !lPos) {
      setRerouteError('Vehicle or landslide position not available.');
      return;
    }

    const activeRouteDest = selectedRoute?.destination || '';
    if (!activeRouteDest) {
      setRerouteError('Original destination not available for rerouting.');
      return;
    }

    setRerouteLoading(true);
    setRerouteError(null);
    setBlockedRouteId(selectedRoute?.route_id || null);

    try {
      const payload = {
        current_location: { lat: vPos[0], lon: vPos[1] },
        destination: activeRouteDest,
        blocked_location: { lat: lPos[0], lon: lPos[1] },
        urgency: queryUrgency,
      };

      const res = await fetch('/reroute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let msg = `Rerouting failed (HTTP ${res.status})`;
        if (typeof errData.detail === 'string') msg = errData.detail;
        else if (Array.isArray(errData.detail)) msg = errData.detail.map(d => d.msg || JSON.stringify(d)).join(' | ');
        setRerouteError(msg);
        return;
      }

      const data = await res.json();
      const eRoutes = Array.isArray(data.routes) ? data.routes : [];

      if (eRoutes.length === 0) {
        setRerouteError('No safe alternative corridor could be generated from the current location.');
        return;
      }

      setEmergencyRoutes(eRoutes);
      setEmergencyRecommendedId(data.recommended_route_id || null);
      const recRoute = eRoutes.find(r => r.route_id === data.recommended_route_id) || eRoutes[0];
      setEmergencySelectedRoute(recRoute);
    } catch (err) {
      setRerouteError(`Network error during rerouting: ${err.message}`);
    } finally {
      setRerouteLoading(false);
    }
  };

  const handleSimReset = () => {
    sim.controls.reset();
    setEmergencyRoutes([]);
    setEmergencyRecommendedId(null);
    setEmergencySelectedRoute(null);
    setRerouteError(null);
    setBlockedRouteId(null);
  };

  const activeWinner = routes.find(r => r.route_id === (recommendedId || backendRecId)) || routes[0];

  return (
    <div className="marg-app-layout">
      {/* Left Sidebar Navigation */}
      <SidebarNav
        activeNav={activeNav}
        onNavChange={(id) => setActiveNav(id)}
        hasRoutes={routes.length > 0}
        hasRecommendation={!!recommendedId}
      />

      {/* Main App Workspace */}
      <div className="marg-main-workspace">
        {/* Top Header */}
        <Header backendConnected={backendConnected} />

        {/* Content Views */}
        <div className="marg-view-viewport">

          {/* ── SCREEN 1: HOME LANDING ── */}
          {activeNav === 'home' && (
            <HomeScreen onGetStarted={() => setActiveNav('planner')} />
          )}

          {/* ── SCREEN 2: ROUTE PLANNER ── */}
          {activeNav === 'planner' && (
            <div className="planner-view-wrapper">
              <SearchSection
                onSearch={handleSearch}
                isLoading={viewState === 'loading'}
              />
            </div>
          )}

          {/* ── SCREEN 3 & 4: MAP & ROUTE EVALUATION ── */}
          {activeNav === 'map' && (
            <div className="map-screen-split">
              {/* Left/Center GIS Map Canvas */}
              <div className="map-canvas-container">
                <RouteMap
                  routes={viewState === 'results' ? routes : []}
                  selectedRoute={selectedRoute}
                  recommendedId={recommendedId || backendRecId}
                  onRouteClick={(r) => setSelectedRoute(r)}
                  vehiclePos={sim.vehiclePos}
                  landslidePos={sim.landslidePos}
                  simState={sim.simState}
                  emergencyRoutes={emergencyRoutes}
                  emergencyRecommendedId={emergencyRecommendedId}
                  onEmergencyRouteClick={(r) => { setEmergencySelectedRoute(r); setSelectedRoute(r); }}
                />

                {/* Floating Demo Control & Simulation Monitor */}
                <DemoControlButton
                  hasRoutes={viewState === 'results' && routes.length > 0}
                  selectedRoute={selectedRoute}
                  simState={sim.simState}
                  progressPct={sim.progressPct}
                  vehiclePos={sim.vehiclePos}
                  landslidePos={sim.landslidePos}
                  controls={{ ...sim.controls, reset: handleSimReset }}
                  onRequestReroute={handleReroute}
                  rerouteLoading={rerouteLoading}
                  rerouteError={rerouteError}
                  hasEmergencyRoutes={emergencyRoutes.length > 0}
                  originalDestination={selectedRoute?.destination || ''}
                />
              </div>

              {/* Right Corridors Panel */}
              <div className="map-side-panel">
                <div className="panel-stepper-header">
                  <span className="panel-stepper-badge">03 ROUTE EVALUATION</span>
                  <span className="panel-corridor-count">
                    {routes.length > 0 ? `${routes.length} Corridors` : 'Awaiting Query'}
                  </span>
                </div>

                <div className="panel-scroll-content">
                  {viewState === 'empty' && (
                    <div className="panel-empty-placeholder">
                      <div className="empty-ph-icon">
                        <IconMap size={36} color="var(--text-tertiary)" />
                      </div>
                      <h3>No Corridors Evaluated</h3>
                      <p>Enter origin and destination in the Route Planner to evaluate transport corridors.</p>
                      <button
                        type="button"
                        className="empty-ph-btn"
                        onClick={() => setActiveNav('planner')}
                      >
                        Open Route Planner →
                      </button>
                    </div>
                  )}

                  {viewState === 'loading' && <LoadingState />}
                  {viewState === 'error' && <ErrorState message={errorMessage} onRetry={handleRetry} />}

                  {viewState === 'results' && (
                    <>
                      <div className="overview-title-block">
                        <h2 className="overview-title">Available Corridors</h2>
                        <p className="overview-subtitle">
                          {routes.length} corridors evaluated across distance, travel time, and terrain hazard.
                        </p>
                      </div>

                      {/* Route Cards */}
                      <div className="overview-cards-list">
                        {routes.map((route, idx) => (
                          <RouteCard
                            key={route.route_id}
                            route={route}
                            index={idx}
                            isSelected={selectedRoute && selectedRoute.route_id === route.route_id}
                            isRecommended={(recommendedId || backendRecId) === route.route_id}
                            comparisonTags={getComparisonTags(route, routes)}
                            onSelect={(r) => setSelectedRoute(r)}
                          />
                        ))}
                      </div>

                      {/* Emergency Rerouting Results (if active) */}
                      {emergencyRoutes.length > 0 && (
                        <EmergencyRoutePanel
                          emergencyRoutes={emergencyRoutes}
                          emergencyRecommendedId={emergencyRecommendedId}
                          selectedRoute={emergencySelectedRoute}
                          onSelectRoute={(r) => { setEmergencySelectedRoute(r); setSelectedRoute(r); }}
                          blockedRouteId={blockedRouteId}
                          destination={selectedRoute?.destination || ''}
                        />
                      )}

                      {/* Analyse / System Recommendation CTA */}
                      <div className="overview-actions-block">
                        <button
                          type="button"
                          className="analyse-corridors-btn"
                          onClick={() => {
                            setActiveNav('decision');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          id="system-recommend-btn"
                        >
                          <span>
                            {selectedRoute?.route_id === (recommendedId || backendRecId)
                              ? 'Analyze Recommended Route →'
                              : `Analyze Selected Route [${selectedRoute?.route_id || 'R1'}] →`}
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SCREEN 5 & 6: DECISION INTELLIGENCE / ANALYSIS ── */}
          {activeNav === 'decision' && (
            <div className="decision-view-wrapper">
              {viewState === 'results' && activeWinner ? (
                <div className="decision-two-col-layout">
                  <div className="decision-col-left">
                    <AIRecommendationPanel
                      recommendedRoute={activeWinner}
                      allRoutes={routes}
                      urgency={queryUrgency}
                    />
                  </div>
                  <div className="decision-col-right">
                    <DecisionIntelligencePanel
                      recommendedRoute={activeWinner}
                      allRoutes={routes}
                      urgency={queryUrgency}
                      selectedRoute={selectedRoute}
                    />
                  </div>
                </div>
              ) : (
                <div className="empty-intel-card">
                  <div className="empty-intel-icon">
                    <IconBarChart size={36} color="var(--text-tertiary)" />
                  </div>
                  <h3>No Decision Analysis Available</h3>
                  <p>Evaluate corridors in the Route Planner first to review detailed AI recommendation rationale.</p>
                  <button type="button" className="empty-ph-btn" onClick={() => setActiveNav('planner')}>
                    Go to Route Planner →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SCREEN 7: RISK INTELLIGENCE ── */}
          {activeNav === 'risk' && (
            <div className="risk-view-wrapper">
              <RiskIntelligenceView
                selectedRoute={selectedRoute}
                allRoutes={routes}
                onSelectRoute={(r) => setSelectedRoute(r)}
              />
            </div>
          )}

          {/* ── SCREEN 8: COMPARE CORRIDORS ── */}
          {activeNav === 'compare' && (
            <div className="compare-view-wrapper">
              <CompareCorridorsView
                routes={routes}
                recommendedId={recommendedId || backendRecId}
                selectedRoute={selectedRoute}
                onSelectRoute={(r) => setSelectedRoute(r)}
                onViewDetails={(r) => { setSelectedRoute(r); setActiveNav('map'); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
