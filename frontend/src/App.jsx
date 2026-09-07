import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SearchSection from './components/SearchSection';
import RouteMap from './components/RouteMap';
import RouteCard from './components/RouteCard';
import { EmptyState, LoadingState, ErrorState } from './components/StateViews';
import { IconSparkles } from './components/Icons';

// Fallback sample data — available ONLY via the UI DEMO button, never auto-shown
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
    coordinates: [
      { lat: 26.1445, lon: 91.7362 },
      { lat: 25.5788, lon: 91.8933 },
      { lat: 25.45, lon: 92.2 },
      { lat: 24.8333, lon: 92.7789 }
    ]
  }
];

export default function App() {
  // View states: 'empty' | 'loading' | 'error' | 'results'
  const [viewState, setViewState]           = useState('empty');
  const [routes, setRoutes]                 = useState([]);
  const [selectedRoute, setSelectedRoute]   = useState(null);
  // recommendedId is null until the user explicitly clicks "AI RECOMMEND ROUTE"
  const [recommendedId, setRecommendedId]   = useState(null);
  // Store what the backend computed as the best route (used when button is clicked)
  const [backendRecId, setBackendRecId]     = useState(null);
  const [errorMessage, setErrorMessage]     = useState('');
  const [backendConnected, setBackendConnected] = useState(false);

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

  // ── Search handler ─────────────────────────────────────────────────────────
  // Fetches ALL evaluated routes and enters exploration mode.
  // No route is marked as AI Recommended until handleRecommend() is called.
  const handleSearch = async ({ origin, destination, urgency }) => {
    setViewState('loading');
    setSelectedRoute(null);
    setRecommendedId(null);
    setBackendRecId(null);
    setErrorMessage('');

    const payload = {
      origin:      origin.trim(),
      destination: destination.trim(),
      urgency:     (urgency || 'MEDIUM').toUpperCase()
    };

    try {
      const response = await fetch('/recommend-route', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
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

      // Preserve all fields exactly — route_id is the integration key.
      // Do NOT set recommended=true on any route yet (exploration mode).
      const formattedRoutes = returnedRoutes.map(r => ({
        ...r,
        route_id: r.route_id   // explicit preservation
      }));

      setRoutes(formattedRoutes);
      setBackendRecId(data.recommended_route_id || null);
      // Auto-select first route for map focus, but do NOT mark it as recommended
      setSelectedRoute(formattedRoutes[0] || null);
      setViewState('results');
    } catch (err) {
      console.error('Backend integration error:', err);
      setErrorMessage(`Failed to communicate with MARG backend: ${err.message}. Ensure FastAPI is active on port 8000.`);
      setViewState('error');
    }
  };

  // ── AI Recommend handler ──────────────────────────────────────────────────
  // ONLY called when user explicitly presses "AI RECOMMEND ROUTE".
  // Uses accessibility_score returned by Person 3 — does NOT recalculate.
  const handleRecommend = () => {
    if (!routes.length) return;

    // Prefer the backend's computed recommendation; fall back to highest score
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

  // Route count label — accurate, never misleading
  const routeCountLabel = routes.length === 1
    ? '1 Route Available'
    : `${routes.length} Routes Available`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <Header backendConnected={backendConnected} />

      {/* Dev State Preview Toolbar */}
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
            onClick={() => { setErrorMessage('Simulated API Error: Backend dispatch service is currently offline or unreachable.'); setViewState('error'); }}>
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
            UI DEMO ONLY — Results Preview
          </button>
        </div>
      </div>

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
            {viewState === 'empty'   && <EmptyState />}
            {viewState === 'loading' && <LoadingState />}
            {viewState === 'error'   && <ErrorState message={errorMessage} onRetry={handleRetry} />}

            {viewState === 'results' && (
              <>
                {/* Exploration header */}
                <div className="results-header">
                  <span className="results-title">Evaluated Corridors</span>
                  <span className="results-count">{routeCountLabel}</span>
                </div>

                {/* Route cards — no recommended badge until button clicked */}
                <div className="route-cards-list">
                  {routes.map(route => (
                    <RouteCard
                      key={route.route_id}
                      route={route}
                      isSelected={selectedRoute && selectedRoute.route_id === route.route_id}
                      isRecommended={recommendedId === route.route_id}
                      onSelect={r => setSelectedRoute(r)}
                    />
                  ))}
                </div>

                {/* AI Recommend button — explicit user action */}
                <button
                  type="button"
                  className={`ai-recommend-btn ${recommendedId ? 'ai-btn-done' : ''}`}
                  onClick={handleRecommend}
                  disabled={!!recommendedId}
                  id="ai-recommend-route-btn"
                >
                  <IconSparkles size={16} />
                  <span>{recommendedId ? 'AI Recommendation Applied' : 'AI RECOMMEND ROUTE'}</span>
                </button>
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
