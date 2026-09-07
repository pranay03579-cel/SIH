import React, { useState } from 'react';
import { IconMapPin, IconNavigation, IconSparkles } from './Icons';

export default function SearchSection({ onSearch, isLoading = false }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [urgency, setUrgency] = useState('MEDIUM');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      return;
    }
    if (onSearch) {
      onSearch({
        origin: origin.trim(),
        destination: destination.trim(),
        urgency
      });
    }
  };

  return (
    <div className="marg-search-card">
      <div className="search-section-title">
        <IconNavigation size={14} />
        <span>Corridor Query &amp; Dispatch</span>
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        {/* Origin */}
        <div className="input-group">
          <label className="input-label" htmlFor="origin-input">
            Origin Hub / Dispatch Point
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <IconMapPin size={16} />
            </span>
            <input
              id="origin-input"
              type="text"
              className="text-input"
              placeholder="e.g., Guwahati"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Destination */}
        <div className="input-group">
          <label className="input-label" htmlFor="destination-input">
            Destination / Forward Outpost
          </label>
          <div className="input-wrapper">
            <span className="input-icon">
              <IconMapPin size={16} />
            </span>
            <input
              id="destination-input"
              type="text"
              className="text-input"
              placeholder="e.g., Silchar"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Urgency */}
        <div className="input-group">
          <label className="input-label" htmlFor="urgency-select">
            Mission Urgency Level
          </label>
          <div className="input-wrapper">
            <select
              id="urgency-select"
              className="select-input"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              disabled={isLoading}
            >
              <option value="LOW">LOW — Standard Transit / Minimal Priority</option>
              <option value="MEDIUM">MEDIUM — Normal Supply Line</option>
              <option value="HIGH">HIGH — Rapid Response / Priority Logistics</option>
              <option value="CRITICAL">CRITICAL — Emergency Relief / High-Risk Corridor</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          className="search-btn"
          id="ai-recommend-btn"
          disabled={isLoading || !origin.trim() || !destination.trim()}
        >
          {isLoading ? (
            <>
              <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span>Analyzing Corridors...</span>
            </>
          ) : (
            <>
              <IconSparkles size={16} />
              <span>EVALUATE ROUTES</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
