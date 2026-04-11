// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import PropTypes from 'prop-types';

/**
 * GarageDoorSVG
 *
 * Scalable SVG illustration of a garage (peaked roof, side pillars, roll-up
 * door with panels). Used by both the compact `TileGarageDoor` control
 * (popup illustration) and the full-size `ControlGarageDoor` control.
 *
 * The door's open amount is driven by `openRatio`:
 *   0   → fully closed (all panels visible)
 *   0.5 → half open (top two panels rolled up)
 *   1   → fully open (cavity showing)
 *
 * To animate, pass a changing `openRatio` (e.g. via react-spring or a CSS
 * transition on a parent that interpolates a prop). This component does
 * not manage its own animation — it renders at whatever ratio you give it.
 */

// SVG design tokens — shared between tile and full control.
const TOKEN = {
  frameBlue: '#1a4f8a',
  panelBlue: '#2a6ab5',
  panelLine: '#a8c8f0',
  cavity:    '#111111',
};

/**
 * Per-state visual config (roof color + glyph). Caller picks the state,
 * this component renders the matching colors/glyphs/ratio.
 */
export const GARAGE_DOOR_STATES = {
  closed: {
    roofColor: '#198038', // IBM green
    glyph: null,
    glyphColor: null,
    stateColor: '#42be65',
    stateLabel: 'Closed',
    openRatio: 0,
    pulse: false,
  },
  open: {
    roofColor: '#da1e28', // IBM red
    glyph: '!',
    glyphColor: '#ffffff',
    stateColor: '#fa4d56',
    stateLabel: 'Open',
    openRatio: 1,
    pulse: false,
  },
  unknown: {
    roofColor: '#6f6f6f',
    glyph: '?',
    glyphColor: '#ffffff',
    stateColor: '#6f6f6f',
    stateLabel: 'Unknown',
    openRatio: 0.5,
    pulse: true,
  },
};

/**
 * Render the door. Accepts either a preset state via `state` (one of
 * 'closed' | 'open' | 'unknown') or a fully custom `config` object.
 * Also accepts an explicit `openRatio` override, which is how callers
 * animate the door between states.
 */
function GarageDoorSVG({
  state,
  config: configProp,
  openRatio,
  width = 82,
  height = 74,
  className,
}) {
  // Resolve the config: explicit > state preset > default closed.
  const baseConfig = configProp || GARAGE_DOOR_STATES[state] || GARAGE_DOOR_STATES.closed;
  const ratio = typeof openRatio === 'number' ? openRatio : baseConfig.openRatio;
  // Blend roof color through a brief transition? No — the caller can swap
  // state when the ratio reaches its endpoint. The SVG just renders what
  // it's told.
  const config = { ...baseConfig, openRatio: ratio };

  const W = width;
  const H = height;
  const roofPeakX = W / 2;
  const roofPeakY = H * 0.04;
  const roofBaseY = H * 0.33;
  const beamH = H * 0.09;
  const pillarW = W * 0.09;
  const pillarTop = roofBaseY + beamH;
  const pillarBot = H - H * 0.02;
  const pillarH = pillarBot - pillarTop;
  const doorX = pillarW;
  const doorW = W - pillarW * 2;
  const doorTop = pillarTop;
  const doorBot = pillarBot;
  const doorH = doorBot - doorTop;
  const openPx = Math.round(config.openRatio * doorH);
  const panelAreaBot = doorBot - openPx;
  const panelCount = 4;
  const panelH = doorH / panelCount;
  const cavityY = doorBot - openPx;
  const alpha = config.pulse ? 0.4 : 1;
  const iconCX = W / 2;
  const iconCY = roofPeakY + (roofBaseY - roofPeakY) * (config.glyph === '!' ? 0.62 : 0.52);
  const fontSize = Math.round(H * 0.18);

  const panels = [];
  for (let i = 0; i < panelCount; i++) {
    const py = doorTop + i * panelH;
    if (py >= panelAreaBot) continue;
    const ch = Math.min(panelH - 1.5, panelAreaBot - py);
    if (ch <= 0) continue;
    panels.push(
      <rect
        key={`p-${i}`}
        x={doorX + 1}
        y={py.toFixed(1)}
        width={doorW - 2}
        height={ch.toFixed(1)}
        rx={1}
        fill={TOKEN.panelBlue}
        opacity={0.9}
      />,
      <line
        key={`l-${i}`}
        x1={doorX + 4}
        y1={(py + ch / 2).toFixed(1)}
        x2={doorX + doorW - 4}
        y2={(py + ch / 2).toFixed(1)}
        stroke={TOKEN.panelLine}
        strokeWidth={0.7}
        opacity={0.5}
      />
    );
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={[config.pulse ? 'garage-door-pulse' : null, className].filter(Boolean).join(' ') || undefined}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Roof */}
      <polygon
        points={`${roofPeakX},${roofPeakY} ${W},${roofBaseY} 0,${roofBaseY}`}
        fill={config.roofColor}
        opacity={alpha}
      />
      {/* Fascia beam */}
      <rect x={0} y={roofBaseY} width={W} height={beamH} fill={TOKEN.frameBlue} opacity={alpha} />
      {/* Left pillar */}
      <rect x={0} y={pillarTop} width={pillarW} height={pillarH} fill={TOKEN.frameBlue} opacity={alpha} />
      {/* Right pillar */}
      <rect
        x={W - pillarW}
        y={pillarTop}
        width={pillarW}
        height={pillarH}
        fill={TOKEN.frameBlue}
        opacity={alpha}
      />
      {/* Dark cavity behind rolled-up panels */}
      {openPx > 0 && <rect x={doorX} y={cavityY} width={doorW} height={openPx} fill={TOKEN.cavity} />}
      {panels}
      {/* State glyph on roof (! for open, ? for unknown) */}
      {config.glyph && (
        <text
          x={iconCX}
          y={iconCY}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="sans-serif"
          fontSize={fontSize}
          fontWeight={700}
          fill={config.glyphColor}
        >
          {config.glyph}
        </text>
      )}
    </svg>
  );
}

GarageDoorSVG.propTypes = {
  state: PropTypes.oneOf(['closed', 'open', 'unknown']),
  config: PropTypes.shape({
    roofColor: PropTypes.string,
    glyph: PropTypes.string,
    glyphColor: PropTypes.string,
    stateColor: PropTypes.string,
    stateLabel: PropTypes.string,
    openRatio: PropTypes.number,
    pulse: PropTypes.bool,
  }),
  openRatio: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  className: PropTypes.string,
};

export default GarageDoorSVG;
