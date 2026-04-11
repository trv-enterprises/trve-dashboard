// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useControlState } from './useControlState';
import { registerControl } from './controlRegistry';
import GarageDoorSVG, { GARAGE_DOOR_STATES } from './GarageDoorSVG';
import './controls.scss';

/**
 * ControlGarageDoor
 *
 * Full-size read-only garage door status control. Subscribes to an MQTT
 * contact sensor and shows an animated door illustration. The door slides
 * open or closed smoothly when the sensor flips.
 *
 * This is the full-panel counterpart to the compact `TileGarageDoor`
 * control. Both share `GarageDoorSVG` for the visual. The tile version
 * uses a popup; this one renders the door to fill the entire panel.
 *
 * State mapping (same as TileGarageDoor):
 *   contact === true  → closed  (zigbee2mqtt convention: contact = reed closed)
 *   contact === false → open
 *   undefined/other   → unknown (pulsing)
 *
 * Animation: when `doorState` changes, we tween the `openRatio` from its
 * current value to the target over ANIMATION_MS. requestAnimationFrame is
 * used because CSS transitions can't interpolate the integer pixel math
 * inside the SVG. The roof color snaps at the midpoint of the transition
 * so it doesn't visibly mismatch the door position.
 */

const ANIMATION_MS = 1500;

function ControlGarageDoor({ control }) {
  const uiConfig = control.control_config?.ui_config || {};

  const { value: contact } = useControlState({
    connectionId: control.connection_id,
    target: control.control_config?.target || '',
    stateField: uiConfig.state_field || 'contact',
    initialValue: undefined,
  });

  // Map raw contact value → discrete door state name.
  let targetState = 'unknown';
  if (contact === true || contact === 'true') targetState = 'closed';
  else if (contact === false || contact === 'false') targetState = 'open';

  // Animated openRatio and the "visible" state name (which follows the
  // animation midpoint so the roof glyph/color flips at the right time).
  const [animRatio, setAnimRatio] = useState(GARAGE_DOOR_STATES[targetState].openRatio);
  const [visibleState, setVisibleState] = useState(targetState);
  const animRef = useRef({ raf: 0, start: 0, from: 0, to: 0, targetState: null });

  useEffect(() => {
    const toRatio = GARAGE_DOOR_STATES[targetState].openRatio;
    // If already at the target, nothing to animate.
    if (animRatio === toRatio && visibleState === targetState) return;

    // If there's an in-flight animation to a different target, abort it
    // and start a new one from wherever we are now.
    cancelAnimationFrame(animRef.current.raf);

    const fromRatio = animRatio;
    animRef.current = {
      raf: 0,
      start: performance.now(),
      from: fromRatio,
      to: toRatio,
      targetState,
    };

    // For "unknown" we still want to jump immediately (pulse effect is
    // visually more important than a smooth slide), so short-circuit.
    if (targetState === 'unknown') {
      setAnimRatio(toRatio);
      setVisibleState('unknown');
      return;
    }

    const tick = (now) => {
      const elapsed = now - animRef.current.start;
      const t = Math.min(1, elapsed / ANIMATION_MS);
      // Ease-in-out cubic for a more natural mechanical feel.
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const current = animRef.current.from + (animRef.current.to - animRef.current.from) * eased;
      setAnimRatio(current);

      // Flip the visible state (roof color, glyph) at the midpoint.
      // Before midpoint: show the "from" state colors. After: show "to".
      if (t >= 0.5 && visibleState !== animRef.current.targetState) {
        setVisibleState(animRef.current.targetState);
      }

      if (t < 1) {
        animRef.current.raf = requestAnimationFrame(tick);
      } else {
        animRef.current.raf = 0;
      }
    };
    animRef.current.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current.raf);
    };
    // We intentionally exclude animRatio and visibleState to avoid
    // re-triggering the animation on each frame — the effect should
    // re-run only when the target state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetState]);

  const displayLabel = GARAGE_DOOR_STATES[visibleState].stateLabel;
  const stateColor = GARAGE_DOOR_STATES[visibleState].stateColor;

  return (
    <div className="control-garage-door">
      <div className="control-garage-door__svg-wrapper">
        <GarageDoorSVG
          state={visibleState}
          openRatio={animRatio}
          width={200}
          height={180}
          className="control-garage-door__svg"
        />
      </div>
      <div className="control-garage-door__footer">
        {/*
          The panel title is rendered by ControlRenderer as a `.control-title`
          above this component. Don't duplicate it here — convention:
          a custom control never places its own title between the icon/visual
          and the state text. See CLAUDE.md → "Custom Control Layout".
        */}
        <span
          className="control-garage-door__state"
          style={{ color: stateColor }}
        >
          {displayLabel.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

ControlGarageDoor.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    title: PropTypes.string,
    connection_id: PropTypes.string,
    control_config: PropTypes.shape({
      target: PropTypes.string,
      ui_config: PropTypes.object,
    }),
  }).isRequired,
  readOnly: PropTypes.bool,
};

registerControl('garage_door', ControlGarageDoor);
export default ControlGarageDoor;
