import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SearchSection from './components/SearchSection';
import RouteMap from './components/RouteMap';
import RouteCard from './components/RouteCard';
import { EmptyState, LoadingState, ErrorState } from './components/StateViews';
import AIRecommendationPanel from './components/AIRecommendationPanel';
import DecisionIntelligencePanel from './components/DecisionIntelligencePanel';

// Fallback sample data — available ONLY via UI preview toolbar
const FALLBACK_ROUTES = [
  {
    route_id: "R1",
    route_name: "Guwahati - Haflong - Silchar",
    distance_km: 180,
    estimated_time_min: 240,
    landslide_risk: 82,
    risk_level: "HIGH",
    accessibility_score: 42,
    distance_score: 100,
    time_score: 100,
    risk_score: 18,
    distance_weight: 0.25,
    time_weight: 0.30,
    risk_weight: 0.45,
    coordinates: [
      { lat: 26.1445, lon: 91.7362 },
      { lat: 25.1643, lon: 93.0167 },
      { lat: 24.8333, lon: 92.7789 }
    ]
  },
  {
    route_id: "R2",
    route_name: "Guwahati - Shillong - Jowai - Silchar",
    distance_km: 205,
    estimated_time_min: 285,
    landslide_risk: 25,
    risk_level: "LOW",
    accessibility_score: 87,
    distance_score: 0,
    time_score: 0,
    risk_score: 75,
    distance_weight: 0.25,
    time_weight: 0.30,
    risk_weight: 0.45,
    coordinates: [
      { lat: 26.1445, lon: 91.7362 },
      { lat: 25.5788, lon: 91.8933 },
      { lat: 25.45, lon: 92.2 },
      { lat: 24.8333, lon: 92.7789 }
    ]
  }
];

// Helper to compute comparative badges across routes
const getComparisonTags = (route, allRoutes) => {
  if (!allRoutes || allRoutes.length <= 1) return [];
  const tags = [];
  const minDist = Math.min(...allRoutes.map(r => r.distance_km ?? Infinity));
  const minTime = Math.min(...allRoutes.map(r => r.estimated_time_min ?? Infinity));
  const minRisk = Math.min(...allRoutes.map(r => r.landslide_risk ?? Infinity));
  const maxScore = Math.max(...allRoutes.map(r => r.accessibility_score ?? -Infinity));

  if (route.distance_km === minDist) tags.push({ label: 'Shortest', type: 'distance', icon: '📏' });
  if (route.estimated_time_min === minTime) tags.push({ label: 'Fastest', type: 'time', icon: '⚡' });
  if (route.landslide_risk === minRisk) tags.push({ label: 'Safest', type: 'risk', icon: '🛡️' });
  if (route.accessibility_score === maxScore) tags.push({ label: 'Highest Score', type: 'score', icon: '⭐' });

  return tags;
};

export default function App() {
  // View states: 'empty' | 'loading' | 'error' | 'results'
  const [viewState, setViewState] = useState('empty');
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  // recommendedId is null during exploration mode
  const [recommendedId, setRecommendedId] = useState(null);
  const [backendRecId, setBackendRecId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [backendConnected, setBackendConnected] = useState(false);
  const [queryUrgency, setQueryUrgency] = useState('MEDIUM');
  // Dev toolbar: only visible when URL contains ?dev=1
  const [showDevTools] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1');

  // Health check on mount
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

  // Search handler: loads all routes for objective exploration
  const handleSearch = async ({ origin, destination, urgency }) => {
    setViewState('loading');
    setSelectedRoute(null);
    setRecommendedId(null);
    setBackendRecId(null);
    setErrorMessage('');
    const normalizedUrgency = (urgency || 'MEDIUM').toUpperCase();
    setQueryUrgency(normalizedUrgency);

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

      // Preserve all fields exactly
      const formattedRoutes = returnedRoutes.map(r => ({
        ...r,
        route_id: r.route_id
      }));

      setRoutes(formattedRoutes);
      setBackendRecId(data.recommended_route_id || null);
      // Auto-select first route for map focus, but do NOT mark it as recommended (exploration mode)
      setSelectedRoute(formattedRoutes[0] || null);
      setViewState('results');
    } catch (err) {
      console.error('Backend integration error:', err);
      setErrorMessage(`Failed to communicate with MARG backend: ${err.message}. Ensure FastAPI is active on port 8000.`);
      setViewState('error');
    }
  };

  // AI Recommend handler (Phase 2 feature)
  const handleRecommend = () => {
    if (!routes.length) return;

    let winner = routes.find(r => r.route_id === backendRecId);
    if (!winner) {
      winner = routes.reduce((best, r) =>
        (r.accessibility_score > (best?.accessibility_score ?? -Infinity)) ? r : best
      , null);
    }
    if (!winner) return;

    setRecommendedId(winner.route_id);
    setSelectedRoute(winner);
  };

  const handleRetry = () => {
    setViewState('empty');
    setRecommendedId(null);
    setBackendRecId(null);
    setErrorMessage('');
  };

  // Route count and corridor comparison subtitle
  const routeCountLabel = routes.length === 1
    ? '1 Corridor Evaluated'
    : `${routes.length} Corridors Evaluated`;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <Header backendConnected={backendConnected} />

      {/* Dev State Preview Toolbar — visible only at ?dev=1 */}
      {showDevTools && (
        <div className="dev-state-switcher">
          <span className="dev-label">UI State Preview:</span>
          <div className="dev-buttons">
            <button type="button" className={`dev-btn ${viewState === 'empty' ? 'active' : ''}`}
              onClick={() => { setViewState('empty'); setRoutes([]); setSelectedRoute(null); setRecommendedId(null); }}>
              Empty State
            </button>
            <button type="button" className={`dev-btn ${viewState === 'loading' ? 'active' : ''}`}
              onClick={() => setViewState('loading')}>
              Loading State
            </button>
            <button type="button" className={`dev-btn ${viewState === 'error' ? 'active' : ''}`}
              onClick={() => { setErrorMessage('Simulated API Error: Route generation service unavailable.'); setViewState('error'); }}>
              Error State
            </button>
            <button type="button" className={`dev-btn ${viewState === 'results' ? 'active' : ''}`}
              onClick={() => {
                setRoutes(FALLBACK_ROUTES);
                setSelectedRoute(FALLBACK_ROUTES[0]);
                setRecommendedId(null);
                setBackendRecId('R2');
                setViewState('results');
              }}>
              Multi-Route Preview (2 Routes)
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard Layout */}
      <div className="marg-container">
        {/* Left Control Panel */}
        <aside className="marg-sidebar">
          <SearchSection
            onSearch={handleSearch}
            isLoading={viewState === 'loading'}
          />

          {/* Dynamic Content */}
          <div className="marg-results-section">
            {viewState === 'empty' && <EmptyState />}
            {viewState === 'loading' && <LoadingState />}
            {viewState === 'error' && <ErrorState message={errorMessage} onRetry={handleRetry} />}

            {viewState === 'results' && (
              <>
                {/* Mode header */}
                <div className="results-header">
                  <div>
                    <span className="results-title">
                      {recommendedId ? 'Decision Analysis' : 'Corridor Assessment'}
                    </span>
                    <div className="results-subtitle">
                      {recommendedId
                        ? 'System recommendation applied — review analysis below'
                        : routes.length > 1
                          ? 'Compare evaluated corridors, then request system recommendation'
                          : 'Single corridor identified for this terrain'}
                    </div>
                  </div>
                  <span className="results-count">{routeCountLabel}</span>
                </div>

                {/* Route Cards List */}
                <div className="route-cards-list">
                  {routes.map((route, idx) => (
                    <RouteCard
                      key={route.route_id}
                      route={route}
                      index={idx}
                      isSelected={selectedRoute && selectedRoute.route_id === route.route_id}
                      isRecommended={recommendedId === route.route_id}
                      comparisonTags={getComparisonTags(route, routes)}
                      onSelect={r => setSelectedRoute(r)}
                    />
                  ))}
                </div>

                {/* System Recommendation button — below cards */}
                <button
                  type="button"
                  className={`ai-recommend-btn ${recommendedId ? 'ai-btn-done' : ''}`}
                  onClick={recommendedId ? undefined : handleRecommend}
                  disabled={!!recommendedId}
                  id="system-recommend-btn"
                >
                  <span>{recommendedId ? '✓ Recommendation Applied' : 'ANALYSE CORRIDORS'}</span>
                </button>

                {/* Recommendation mode — AI panels */}
                {recommendedId && (() => {
                  const winner = routes.find(r => r.route_id === recommendedId);
                  if (!winner) return null;
                  return (
                    <>
                      {/* Section divider */}
                      <div className="rec-mode-divider">
                        <span className="rec-mode-divider-label">DECISION ANALYSIS</span>
                      </div>

                      {/* Phase 2 — Compact recommendation summary */}
                      <AIRecommendationPanel
                        recommendedRoute={winner}
                        allRoutes={routes}
                        urgency={queryUrgency}
                      />

                      {/* Phase 3 — Full decision analysis */}
                      <DecisionIntelligencePanel
                        recommendedRoute={winner}
                        allRoutes={routes}
                        urgency={queryUrgency}
                        selectedRoute={selectedRoute}
                      />
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </aside>

        {/* Right Interactive Map */}
        <main className="marg-map-container">
          <RouteMap
            routes={viewState === 'results' ? routes : []}
            selectedRoute={selectedRoute}
            recommendedId={recommendedId}
            onRouteClick={r => setSelectedRoute(r)}
          />
        </main>
      </div>
    </div>
  );
}
