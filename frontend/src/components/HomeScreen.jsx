import React from 'react';
import { IconMap, IconSparkles, IconAlertTriangle, IconShield } from './Icons';

export default function HomeScreen({ onGetStarted }) {
  const capabilities = [
    {
      id: 'gis',
      icon: IconMap,
      title: 'GIS Powered Mapping',
      desc: 'Interactive geographic intelligence with real-time route geometry and terrain layers.',
      color: 'var(--pale-blue)'
    },
    {
      id: 'ai',
      icon: IconSparkles,
      title: 'AI Driven Recommendations',
      desc: 'Urgency-weighted decision intelligence balancing transit time and terrain safety.',
      color: 'var(--sage-accent)'
    },
    {
      id: 'landslide',
      icon: IconAlertTriangle,
      title: 'Landslide Risk Analysis',
      desc: 'RandomForest ML predictions using real-time Open-Meteo rainfall and terrain slope.',
      color: 'var(--soft-peach)'
    },
    {
      id: 'accessibility',
      icon: IconShield,
      title: 'Accessibility Intelligence Score',
      desc: 'Standardised 0–100 composite index for critical decision-making in mountain logistics.',
      color: 'var(--dusty-lavender)'
    },
  ];

  return (
    <div className="home-screen-container">
      {/* Hero Section */}
      <div className="home-hero-card">
        <div className="home-hero-content">
          <div className="home-hero-badge">
            <span className="home-hero-badge-dot" />
            <span>SMARTER ROUTES. SAFER MISSIONS.</span>
          </div>

          <h1 className="home-hero-title">
            Plan safer.<br />Choose smarter.
          </h1>

          <p className="home-hero-desc">
            MARG evaluates transport corridors in the North Eastern Region of India
            using real-time environmental hazards, mathematical accessibility scoring,
            and machine-learned landslide prediction models.
          </p>

          <div className="home-hero-actions">
            <button
              type="button"
              className="home-cta-btn"
              onClick={onGetStarted}
              id="home-get-started-btn"
            >
              <span>Get Started</span>
              <span className="home-cta-arrow">→</span>
            </button>
          </div>
        </div>

        {/* Hero Visual: Professional Abstract GIS Logistics Network */}
        <div className="home-hero-visual">
          <div className="hero-gis-network-card">
            <svg
              className="hero-gis-svg"
              viewBox="0 0 380 220"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Northeast Corridor Network Visualization"
            >
              <defs>
                <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#EEF4F0" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="primaryCorridorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#2D5A43" />
                  <stop offset="100%" stopColor="#4A7C59" />
                </linearGradient>
                <filter id="corridorGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background gradient panel */}
              <rect width="380" height="220" rx="10" fill="url(#gridGrad)" />

              {/* Subtle Coordinate Grid Lines */}
              <line x1="40" y1="20" x2="40" y2="200" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="120" y1="20" x2="120" y2="200" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="200" y1="20" x2="200" y2="200" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="280" y1="20" x2="280" y2="200" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="360" y1="20" x2="360" y2="200" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />

              <line x1="20" y1="50" x2="360" y2="50" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="20" y1="110" x2="360" y2="110" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="20" y1="170" x2="360" y2="170" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />

              {/* Terrain Elevation Isobar Contours */}
              <path
                d="M 20,180 Q 90,120 160,150 T 300,100 T 380,80"
                stroke="#D1E7DD"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M 20,150 Q 110,80 190,120 T 320,70 T 380,50"
                stroke="#D8E8E0"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                fill="none"
              />
              <path
                d="M 20,120 Q 80,40 180,70 T 340,40 T 380,30"
                stroke="#E2EDE6"
                strokeWidth="1.0"
                fill="none"
              />

              {/* Secondary/Alternative Corridor Network Arcs */}
              <path
                d="M 70,135 Q 120,70 210,95"
                stroke="#D97706"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                strokeLinecap="round"
                fill="none"
                opacity="0.85"
              />
              <path
                d="M 210,95 Q 260,65 315,55"
                stroke="#64748B"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
                fill="none"
                opacity="0.6"
              />
              <path
                d="M 70,135 Q 160,195 260,175"
                stroke="#64748B"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
                fill="none"
                opacity="0.6"
              />

              {/* Primary Optimal Corridor (Forest Green with subtle flow) */}
              <path
                d="M 70,135 Q 130,130 150,155 T 210,95"
                stroke="url(#primaryCorridorGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                filter="url(#corridorGlow)"
              />

              {/* Spur Line to Shillong */}
              <path
                d="M 70,135 L 125,175"
                stroke="#2D5A43"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.75"
              />

              {/* Hub Node: Shillong (125, 175) */}
              <circle cx="125" cy="175" r="4" fill="#2D5A43" />
              <text x="135" y="179" fill="#475569" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">SHL</text>

              {/* Hub Node: Silchar (260, 175) */}
              <circle cx="260" cy="175" r="4" fill="#64748B" />
              <text x="268" y="179" fill="#475569" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">SIL</text>

              {/* Hub Node: Itanagar (315, 55) */}
              <circle cx="315" cy="55" r="4.5" fill="#64748B" />
              <text x="325" y="59" fill="#475569" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">ITA</text>

              {/* Hub Node: Tezpur (210, 95) - Destination */}
              <circle cx="210" cy="95" r="10" fill="#2D5A43" fillOpacity="0.15" />
              <circle cx="210" cy="95" r="5.5" fill="#2D5A43" />
              <circle cx="210" cy="95" r="2.5" fill="#FFFFFF" />
              <text x="222" y="99" fill="#1E293B" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700">TEZPUR [B]</text>

              {/* Hub Node: Guwahati (70, 135) - Origin */}
              <circle cx="70" cy="135" r="12" fill="#2563EB" fillOpacity="0.15" />
              <circle cx="70" cy="135" r="6" fill="#2563EB" />
              <circle cx="70" cy="135" r="2.5" fill="#FFFFFF" />
              <text x="18" y="139" fill="#1E293B" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700">GUW [A]</text>
            </svg>

            {/* Bottom Telemetry Caption */}
            <div className="hero-gis-caption">
              <div className="hero-gis-caption-left">
                <span className="hero-gis-pulse-dot" />
                <span className="hero-gis-caption-title">Northeast Corridor Mesh</span>
              </div>
              <span className="hero-gis-caption-tag">Multi-Factor Spatial Engine</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Capability Cards */}
      <div className="home-features-grid">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div key={cap.id} className="home-feature-card">
              <div className="home-feature-icon-wrapper" style={{ backgroundColor: cap.color }}>
                <Icon size={20} />
              </div>
              <h3 className="home-feature-title">{cap.title}</h3>
              <p className="home-feature-desc">{cap.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
