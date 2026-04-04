// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@mdi/react';
import { mdiLightbulbOn } from '@mdi/js';
import PropTypes from 'prop-types';
import { useControlState } from './useControlState';
import { useTileFontSize } from './useTileFontSize';
import { registerControl } from './controlRegistry';
import ControlDimmer from './ControlDimmer';
import './controls.scss';

function TileDimmer({ control, readOnly = false, onSuccess, onError }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const tileRef = useRef(null);
  const fontSize = useTileFontSize();

  const uiConfig = control.control_config?.ui_config || {};
  const displayName = control.title || control.name || uiConfig.label || 'Light';
  const min = uiConfig.min ?? 0;
  const max = uiConfig.max ?? 100;

  const { value: level } = useControlState({
    connectionId: control.connection_id,
    target: control.control_config?.target || '',
    stateField: uiConfig.state_field || 'level',
    fallbackFields: ['level', 'brightness'],
    transform: (raw) => {
      const num = Number(raw);
      return !isNaN(num) ? Math.max(min, Math.min(max, num)) : undefined;
    },
    initialValue: 0
  });

  const fillPercent = ((level - min) / (max - min)) * 100;
  const isOn = level > min;
  const isHigh = fillPercent > 50;

  const handleTileClick = useCallback(() => {
    if (popupOpen) {
      setPopupOpen(false);
      return;
    }
    if (!tileRef.current) return;
    const rect = tileRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const popupHeight = 260;
    const openAbove = rect.top > popupHeight;
    const centerX = rect.left + rect.width / 2;

    setPopupStyle({
      position: 'fixed',
      left: centerX,
      transform: 'translateX(-50%)',
      ...(openAbove
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      zIndex: 9999,
    });
    setPopupOpen(true);
  }, [popupOpen]);

  return (
    <div className="tile-wrapper" ref={tileRef}>
      <div
        className={`tile-dimmer ${isHigh ? 'tile-dimmer-high' : 'tile-dimmer-low'}`}
        style={{ fontSize }}
        onClick={handleTileClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTileClick(); }}
        aria-label={`${displayName}: ${isOn ? `${Math.round(level)}%` : 'Off'}`}
      >
        <div className="tile-dimmer-fill" style={{ height: `${fillPercent}%` }} />
        <Icon path={mdiLightbulbOn} size={0.8} className="tile-icon" />
        <span className="tile-name">{displayName}</span>
        <div className="tile-bottom-row">
          <span className="tile-state">{isOn ? 'ON' : 'OFF'}</span>
          <span className="tile-value">{isOn ? `${Math.round(level)}%` : ''}</span>
        </div>
      </div>

      {popupOpen && createPortal(
        <>
          <div className="tile-popup-backdrop" onClick={() => setPopupOpen(false)} />
          <div className="tile-popup" style={popupStyle}>
            <ControlDimmer
              control={control}
              readOnly={readOnly}
              onSuccess={onSuccess}
              onError={onError}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

TileDimmer.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    title: PropTypes.string,
    connection_id: PropTypes.string,
    control_config: PropTypes.shape({
      target: PropTypes.string,
      ui_config: PropTypes.object
    })
  }).isRequired,
  readOnly: PropTypes.bool,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

registerControl('tile_dimmer', TileDimmer);
export default TileDimmer;
