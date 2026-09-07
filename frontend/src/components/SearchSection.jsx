import React, { useState } from 'react';
import { IconMapPin } from './Icons';

export default function SearchSection({ onSearch, isLoading = false }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [urgency, setUrgency] = useState('MEDIUM');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    if (onSearch) {
      onSearch({ origin: origin.trim(), destination: destination.trim(), urgency });
    }
  };

  return (
    <div className="marg-search-card">
      <div className="search-section-title">
        CORRIDOR ASSESSMENT
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        {/* Origin */}
        <div className="input-group">
          <label className="input-label" htmlFor="origin-input">
            Origin Hub
          </label>
          <div className="input-wrapper">
            <span className="input-icon"><IconMapPin size={14} /></span>
            <input
              id="origin-input"
              type="text"
              className="text-input"
              placeholder="e.g., Guwahati, Assam"
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
            Destination / Forward Post
          </label>
          <div className="input-wrapper">
            <span className="input-icon"><IconMapPin size={14} /></span>
            <input
              id="destination-input"
              type="text"
              className="text-input"
              placeholder="e.g., Silchar, Assam"
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
            Mission Urgency
          </label>
          <div className="input-wrapper">
            <select
              id="urgency-select"
              className="select-input"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              disabled={isLoading}
            >
              <option value="LOW">LOW — Standard Transit</option>
              <option value="MEDIUM">MEDIUM — Normal Supply Line</option>
              <option value="HIGH">HIGH — Rapid Response</option>
              <option value="CRITICAL">CRITICAL — Emergency Relief</option>
            </select>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="search-btn"
          id="evaluate-corridors-btn"
          disabled={isLoading || !origin.trim() || !destination.trim()}
        >
          {isLoading ? (
            <>
              <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span>Evaluating Corridors...</span>
            </>
          ) : (
            <span>EVALUATE CORRIDORS</span>
          )}
        </button>
      </form>
    </div>
  );
}
