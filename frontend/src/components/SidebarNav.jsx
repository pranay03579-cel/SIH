import React from 'react';
import {
  IconHome,
  IconRoute,
  IconMap,
  IconBarChart,
  IconAlertTriangle,
  IconCompare,
  IconTree
} from './Icons';

export default function SidebarNav({
  activeNav = 'home',
  onNavChange,
  hasRoutes = false,
  hasRecommendation = false
}) {
  const navItems = [
    { id: 'home', label: 'Home', icon: IconHome },
    { id: 'planner', label: 'Route Planner', icon: IconRoute },
    { id: 'map', label: 'Map', icon: IconMap, count: hasRoutes ? null : null },
    { id: 'decision', label: 'Analysis', icon: IconBarChart, badge: hasRecommendation ? 'AI' : null },
    { id: 'risk', label: 'Risk Intel', icon: IconAlertTriangle },
    { id: 'compare', label: 'Compare', icon: IconCompare },
  ];

  return (
    <nav className="marg-sidebar-nav" aria-label="Main Navigation">
      {/* Brand logo at top of sidebar */}
      <div className="sidebar-brand" onClick={() => onNavChange('home')} role="button" tabIndex={0}>
        <div className="sidebar-brand-icon">
          <IconTree size={20} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">MARG</span>
          <span className="sidebar-brand-sub">LOGISTICS AI</span>
        </div>
      </div>

      {/* Nav links */}
      <div className="sidebar-nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="sidebar-nav-icon">
                <Icon size={18} />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge && (
                <span className="sidebar-nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom system indicator */}
      <div className="sidebar-footer">
        <div className="sidebar-version-pill">
          <span>MARG v2.4</span>
        </div>
      </div>
    </nav>
  );
}
