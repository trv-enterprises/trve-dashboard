// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@mdi/react';
import { mdiGarage } from '@mdi/js';
import PropTypes from 'prop-types';
import { useControlState } from './useControlState';
import { useTileFontSize } from './useTileFontSize';
import { formatTitle } from './controlUtils';
import { registerControl } from './controlRegistry';
import './controls.scss';

// SVG design tokens
const TOKEN = {
  frameBlue: '#1a4f8a',
  panelBlue: '#2a6ab5',
  panelLine: '#a8c8f0',
  cavity:    '#111111',
};

// State config for the popup illustration
const DOOR_CONFIG = {
  closed: {
    roofColor: '#198038', glyph: null, glyphColor: null,
    stateColor: '#42be65', stateLabel: 'Closed', openRatio: 0, pulse: false,
  },
  open: {
    roofColor: '#da1e28', glyph: '!', glyphColor: '#ffffff',
    stateColor: '#fa4d56', stateLabel: 'Open', openRatio: 1, pulse: false,
  },
  unknown: {
    roofColor: '#6f6f6f', glyph: '?', glyphColor: '#ffffff',
    stateColor: '#6f6f6f', stateLabel: 'Unknown', openRatio: 0.5, pulse: true,
  },
};

function DoorSVG({ config, width = 82, height = 74 }) {
  const W = width;
  const H = height;
  const roofPeakX = W / 2;
  const roofPeakY = H * 0.04;
  const roofBaseY = H * 0.33;
  const beamH     = H * 0.09;
  const pillarW   = W * 0.09;
  const pillarTop = roofBaseY + beamH;
  const pillarBot = H - H * 0.02;
  const pillarH   = pillarBot - pillarTop;
  const doorX     = pillarW;
  const doorW     = W - pillarW * 2;
  const doorTop   = pillarTop;
  const doorBot   = pillarBot;
  const doorH     = doorBot - doorTop;
  const openPx      = Math.round(config.openRatio * doorH);
  const panelAreaBot = doorBot - openPx;
  const panelCount   = 4;
  const panelH       = doorH / panelCount;
  const cavityY  = doorBot - openPx;
  const alpha    = config.pulse ? 0.4 : 1;
  const iconCX   = W / 2;
  const iconCY   = roofPeakY + (roofBaseY - roofPeakY) * (config.glyph === '!' ? 0.62 : 0.52);
  const fontSize = Math.round(H * 0.18);

  const panels = [];
  for (let i = 0; i < panelCount; i++) {
    const py = doorTop + i * panelH;
    if (py >= panelAreaBot) continue;
    const ch = Math.min(panelH - 1.5, panelAreaBot - py);
    if (ch <= 0) continue;
    panels.push(
      <rect key={`p-${i}`} x={doorX + 1} y={py.toFixed(1)} width={doorW - 2} height={ch.toFixed(1)} rx={1} fill={TOKEN.panelBlue} opacity={0.9} />,
      <line key={`l-${i}`} x1={doorX + 4} y1={(py + ch / 2).toFixed(1)} x2={doorX + doorW - 4} y2={(py + ch / 2).toFixed(1)} stroke={TOKEN.panelLine} strokeWidth={0.7} opacity={0.5} />
    );
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
      className={config.pulse ? 'tile-garage-door-pulse' : undefined}>
      <polygon points={`${roofPeakX},${roofPeakY} ${W},${roofBaseY} 0,${roofBaseY}`} fill={config.roofColor} opacity={alpha} />
      <rect x={0} y={roofBaseY} width={W} height={beamH} fill={TOKEN.frameBlue} opacity={alpha} />
      <rect x={0} y={pillarTop} width={pillarW} height={pillarH} fill={TOKEN.frameBlue} opacity={alpha} />
      <rect x={W - pillarW} y={pillarTop} width={pillarW} height={pillarH} fill={TOKEN.frameBlue} opacity={alpha} />
      {openPx > 0 && <rect x={doorX} y={cavityY} width={doorW} height={openPx} fill={TOKEN.cavity} />}
      {panels}
      {config.glyph && (
        <text x={iconCX} y={iconCY} textAnchor="middle" dominantBaseline="central"
          fontFamily="sans-serif" fontSize={fontSize} fontWeight={700} fill={config.glyphColor}>
          {config.glyph}
        </text>
      )}
    </svg>
  );
}

function TileGarageDoor({ control, readOnly = false }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const tileRef = useRef(null);
  const fontSize = useTileFontSize();

  const uiConfig = control.control_config?.ui_config || {};
  const displayName = control.title || control.name || uiConfig.label || 'Garage';

  const { value: contact } = useControlState({
    connectionId: control.connection_id,
    target: control.control_config?.target || '',
    stateField: uiConfig.state_field || 'contact',
    initialValue: undefined
  });

  let doorState = 'unknown';
  if (contact === true || contact === 'true') doorState = 'closed';
  else if (contact === false || contact === 'false') doorState = 'open';

  const isOpen = doorState === 'open';
  const stateLabel = DOOR_CONFIG[doorState].stateLabel;
  const doorConfig = DOOR_CONFIG[doorState];

  const handleTileClick = useCallback(() => {
    if (popupOpen) {
      setPopupOpen(false);
      return;
    }
    if (!tileRef.current) return;
    const tileButton = tileRef.current.querySelector('.tile-garage-door');
    const btnRect = tileButton ? tileButton.getBoundingClientRect() : tileRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const openRight = btnCenterX < viewportWidth / 2;
    const openAbove = btnRect.top > viewportHeight / 2;

    setPopupStyle({
      position: 'fixed',
      ...(openRight
        ? { right: viewportWidth - btnRect.right - 39 }
        : { left: btnRect.left - 41 }),
      ...(openAbove
        ? { bottom: viewportHeight - btnRect.top + 2 }
        : { top: btnRect.bottom + 2 }),
      zIndex: 9999,
    });
    setPopupOpen(true);
  }, [popupOpen]);

  return (
    <div className="tile-wrapper" ref={tileRef}>
      <div
        className={`tile-garage-door ${isOpen ? 'tile-garage-door--open' : 'tile-garage-door--closed'}`}
        style={{ fontSize }}
        onClick={(e) => { e.stopPropagation(); handleTileClick(); }}
        onDoubleClick={(e) => e.stopPropagation()}
        role="status"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTileClick(); }}
        aria-label={`${displayName}: ${stateLabel}`}
      >
        <Icon path={mdiGarage} size={0.8} className="tile-icon" />
        <span className="tile-name">{formatTitle(displayName)}</span>
        <span className="tile-state">{stateLabel.toUpperCase()}</span>
      </div>

      {popupOpen && createPortal(
        <>
          <div className="tile-popup-backdrop" onClick={(e) => { e.stopPropagation(); setPopupOpen(false); }} onDoubleClick={(e) => e.stopPropagation()} />
          <div className="tile-popup tile-garage-door-popup" style={popupStyle}>
            <DoorSVG config={doorConfig} width={120} height={108} />
            <span className="popup-label">{displayName}</span>
            <span className="popup-state" style={{ color: doorConfig.stateColor }}>
              {stateLabel.toUpperCase()}
            </span>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

TileGarageDoor.propTypes = {
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
  readOnly: PropTypes.bool
};

registerControl('tile_garage_door', TileGarageDoor);
export default TileGarageDoor;
