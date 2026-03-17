import React, { useState, useEffect, useRef } from "react";

// Carbon Design System tokens — Gray-100 theme (g100)
// $background = #161616 (page), $layer-01 = #262626 (cards/panels)
// Interactive blue on dark backgrounds = #4589ff (not #0f62fe which is light-theme only)
const tokens = {
  background: "#161616",       // $background — page shell
  backgroundHover: "#292929",
  layer01: "#262626",          // $layer-01 — card surface (matches your dashboard panels)
  layer02: "#393939",          // $layer-02 — inset surfaces
  layer03: "#525252",          // $layer-03 — disabled fills
  layerAccent01: "#393939",
  borderSubtle: "#393939",     // $border-subtle-01 on g100
  borderStrong: "#6f6f6f",     // $border-strong-01
  textPrimary: "#f4f4f4",      // $text-primary
  textSecondary: "#c6c6c6",    // $text-secondary
  textDisabled: "#525252",     // $text-disabled
  textOnColor: "#ffffff",      // $text-on-color
  interactive: "#4589ff",      // $interactive on g100 dark (accessible on #262626)
  interactiveHover: "#6ea6ff", // $interactive hover
  supportSuccess: "#42be65",   // $support-success
  supportError: "#ff8389",     // $support-error on g100 (lighter for dark bg contrast)
  supportWarning: "#f1c21b",   // $support-warning
  supportInfo: "#4589ff",      // $support-info
  focus: "#4589ff",            // $focus on g100
  iconPrimary: "#f4f4f4",
  iconSecondary: "#c6c6c6",
  iconDisabled: "#525252",
};

// Door states
const DOOR_STATE = {
  CLOSED: "closed",
  OPEN: "open",
  OPENING: "opening",
  CLOSING: "closing",
  STOPPED: "stopped",
  OBSTRUCTION: "obstruction",
};

const DOOR_TRAVEL_MS = 4000;

// Minimal SVG icons matching Carbon's 16px grid
const IconChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4L14 10 13 11 8 6 3 11 2 10z" />
  </svg>
);
const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 12L2 6 3 5 8 10 13 5 14 6z" />
  </svg>
);
const IconStop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="4" y="4" width="8" height="8" />
  </svg>
);
const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1L15 14H1L8 1zm0 2.5L2.5 13h11L8 3.5zM7.5 7h1v3h-1V7zm0 4h1v1h-1v-1z" />
  </svg>
);
const IconCheckmark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6 11.5L2.5 8 3.5 7 6 9.5 12.5 3 13.5 4z" />
  </svg>
);
const IconGarage = () => (
  <svg width="22" height="22" viewBox="0 0 100 100" fill="currentColor">
    {/* Peaked roofline */}
    <path d="M50 4 L96 32 L96 40 L4 40 L4 32 Z" />
    {/* Side walls */}
    <rect x="4" y="38" width="10" height="58" />
    <rect x="86" y="38" width="10" height="58" />
    {/* Circular vent above door */}
    <circle cx="50" cy="24" r="8" fill="none" stroke="currentColor" strokeWidth="5" />
    {/* 5 door panels */}
    <rect x="18" y="44" width="64" height="8" rx="1" />
    <rect x="18" y="54" width="64" height="8" rx="1" />
    <rect x="18" y="64" width="64" height="8" rx="1" />
    <rect x="18" y="74" width="64" height="8" rx="1" />
    <rect x="18" y="84" width="64" height="10" rx="1" />
  </svg>
);

// Animated garage facade schematic
function DoorSchematic({ doorState, progress }) {
  const isObstruction = doorState === DOOR_STATE.OBSTRUCTION;
  const isMoving = doorState === DOOR_STATE.OPENING || doorState === DOOR_STATE.CLOSING;

  const W  = 160;
  const cx = W / 2;

  const bldLeft  = 8;
  const bldRight = 152;
  const bldW     = bldRight - bldLeft;

  const roofPeakY = 8;
  const eavesY    = 44;
  const fasciaBot = 52;   // top of door opening

  const pillarW     = 14;
  const pillarLeft  = bldLeft;
  const pillarRight = bldRight - pillarW;
  const pillarBot   = 118;  // bottom of door opening

  const doorLeft  = pillarLeft  + pillarW;  // 22
  const doorRight = pillarRight;            // 138
  const doorW     = doorRight - doorLeft;   // 116
  const doorTop   = fasciaBot;              // 52
  const doorBot   = pillarBot;             // 118
  const doorH     = doorBot - doorTop;      // 66

  const ventCX = cx;
  const ventCY = 28;

  // ── Animation model ───────────────────────────────────────────────
  // The door panel is doorH tall. It starts with its TOP at doorTop (closed).
  // As it opens it translates upward: top moves from doorTop to doorTop - doorH.
  // The fascia rect (drawn on top) masks anything above doorTop.
  // Result: visible portion shrinks from the top down, bottom edge stays at doorBot
  // until the panel fully disappears above doorTop.
  //
  //   progress=0 → panelTop=doorTop,      visible height=doorH   (fully closed)
  //   progress=0.5 → panelTop=doorTop-33, visible height=33      (half open)
  //   progress=1 → panelTop=doorTop-doorH, visible height=0      (fully open)

  const rolledUp   = progress * doorH;
  const panelTop   = doorTop - rolledUp;    // translates upward
  const panelBot   = panelTop + doorH;      // always doorH below panelTop = doorBot when closed

  const panelFill   = isObstruction ? "rgba(255,131,137,0.15)" : "#4a4a4a";
  const panelStroke = isObstruction ? tokens.supportError : tokens.borderStrong;

  // Groove lines: fixed positions on the door surface (relative to panelTop)
  const grooveCount = 4;  // 4 grooves = 5 panels

  return (
    <svg
      width="160"
      height="130"
      viewBox="0 0 160 130"
      style={{ display: "block", margin: "0 auto" }}
    >
      {/* ── 1. Dark void — fixed, always fills the full opening ─────── */}
      <rect x={doorLeft} y={doorTop} width={doorW} height={doorH} fill="#0c0c0c" />

      {/* ── 2. Door panel — translates upward, masked by fascia above ── */}
      <rect
        x={doorLeft + 1}
        y={panelTop}
        width={doorW - 2}
        height={doorH}
        fill={panelFill}
        stroke={panelStroke}
        strokeWidth="0.75"
      />

      {/* Grooves — fixed offsets from panelTop */}
      {Array.from({ length: grooveCount }).map((_, i) => {
        const grooveY = panelTop + (i + 1) * (doorH / (grooveCount + 1));
        // Only draw if groove is within the visible door opening
        if (grooveY < doorTop || grooveY > doorBot) return null;
        return (
          <line key={i}
            x1={doorLeft + 6}  y1={grooveY}
            x2={doorRight - 6} y2={grooveY}
            stroke={panelStroke} strokeWidth="1" opacity="0.5"
          />
        );
      })}

      {/* Handle — fixed to bottom of door panel, hidden when near open */}
      {panelBot > doorTop + 8 && progress < 0.92 && (
        <rect
          x={cx - 10} y={panelBot - 8}
          width={20} height={3.5}
          fill={tokens.borderStrong} rx="1.5"
        />
      )}

      {/* Obstruction bar */}
      {isObstruction && (
        <rect x={doorLeft} y={doorBot - 5} width={doorW} height={5}
          fill={tokens.supportError} opacity="0.9" />
      )}

      {/* ── 3. Building — always painted on top, masks panel overflow ── */}

      {/* Full background mask — covers entire area above doorTop so
          the panel cannot bleed into the roof/gable region */}
      <rect x={bldLeft} y={0} width={bldW} height={doorTop}
        fill={tokens.layer02} />

      {/* Roof gable — on top of mask */}
      <path
        d={`M${cx} ${roofPeakY} L${bldRight} ${eavesY} L${bldLeft} ${eavesY} Z`}
        fill={tokens.layer03} stroke={tokens.borderStrong}
        strokeWidth="1.5" strokeLinejoin="round"
      />

      {/* Fascia */}
      <rect x={bldLeft} y={eavesY} width={bldW} height={fasciaBot - eavesY}
        fill={tokens.layer03} stroke={tokens.borderStrong} strokeWidth="1" />

      {/* Vent */}
      <circle cx={ventCX} cy={ventCY} r="12"
        fill={tokens.layer02} stroke={tokens.borderStrong} strokeWidth="2.5" />
      <circle cx={ventCX} cy={ventCY} r="5" fill={tokens.layer03} />

      {/* Side pillars */}
      <rect x={pillarLeft}  y={fasciaBot} width={pillarW} height={pillarBot - fasciaBot}
        fill={tokens.layer03} stroke={tokens.borderStrong} strokeWidth="1" />
      <rect x={pillarRight} y={fasciaBot} width={pillarW} height={pillarBot - fasciaBot}
        fill={tokens.layer03} stroke={tokens.borderStrong} strokeWidth="1" />

      {/* Track rails */}
      <line x1={doorLeft}  y1={doorTop} x2={doorLeft}  y2={doorBot}
        stroke={tokens.borderSubtle} strokeWidth="1.5" />
      <line x1={doorRight} y1={doorTop} x2={doorRight} y2={doorBot}
        stroke={tokens.borderSubtle} strokeWidth="1.5" />

      {/* Ground slab — covers panel bottom edge */}
      <rect x={bldLeft} y={pillarBot} width={bldW} height={6} fill={tokens.layer03} />
      <line x1={bldLeft} y1={pillarBot} x2={bldRight} y2={pillarBot}
        stroke={tokens.borderStrong} strokeWidth="1.5" />

      {/* ── 4. Motion shimmer just above rising door edge ───────────── */}
      {isMoving && panelTop > doorTop - doorH && panelTop < doorBot && (
        [0.2, 0.5, 0.8].map((xFrac, i) => (
          <line key={i}
            x1={doorLeft + doorW * xFrac - 10} y1={Math.max(panelTop, doorTop) + 4}
            x2={doorLeft + doorW * xFrac + 10} y2={Math.max(panelTop, doorTop) + 4}
            stroke={tokens.interactive} strokeWidth="1.5"
            opacity={0.3 + i * 0.15}
          />
        ))
      )}
    </svg>
  );
}
// Status badge with tooltip — carries all notification detail on hover
function StatusBadge({ doorState, lastAction, timestamp }) {
  const [hovered, setHovered] = React.useState(false);

  const config = {
    [DOOR_STATE.CLOSED]:      { color: tokens.textSecondary, label: "Closed",               detail: "Door is fully closed." },
    [DOOR_STATE.OPEN]:        { color: tokens.supportSuccess, label: "Open",                detail: "Door is fully open." },
    [DOOR_STATE.OPENING]:     { color: tokens.interactive,   label: "Opening…",             detail: "Door is in motion — opening." },
    [DOOR_STATE.CLOSING]:     { color: tokens.interactive,   label: "Closing…",             detail: "Door is in motion — closing." },
    [DOOR_STATE.STOPPED]:     { color: tokens.supportWarning, label: "Stopped",             detail: "Door stopped mid-travel. Resume or open manually." },
    [DOOR_STATE.OBSTRUCTION]: { color: tokens.supportError,  label: "Obstruction",          detail: "Obstruction detected. Door reversed. Clear path and retry." },
  };

  const { color, label, detail } = config[doorState] || config[DOOR_STATE.CLOSED];
  const isMoving = doorState === DOOR_STATE.OPENING || doorState === DOOR_STATE.CLOSING;
  const isError  = doorState === DOOR_STATE.OBSTRUCTION;

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Badge pill */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        color,
        fontSize: "12px",
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: "0.02em",
        cursor: "default",
        padding: "2px 6px",
        border: `1px solid ${hovered ? color : "transparent"}`,
        transition: "border-color 0.15s ease, color 0.2s ease",
      }}>
        {/* Pulse dot */}
        <span style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          flexShrink: 0,
          animation: isMoving ? "pulse 1.2s ease-in-out infinite" : "none",
        }} />
        {label}
      </div>

      {/* Tooltip — appears on hover, positioned below badge */}
      {hovered && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          zIndex: 100,
          width: "220px",
          background: tokens.layer03,
          border: `1px solid ${color}`,
          borderLeft: `3px solid ${color}`,
          padding: "8px 10px",
          pointerEvents: "none",
        }}>
          <div style={{
            fontSize: "12px",
            fontFamily: "'IBM Plex Sans', sans-serif",
            color: tokens.textPrimary,
            lineHeight: "1.4",
            marginBottom: lastAction ? "6px" : 0,
          }}>
            {detail}
          </div>
          {(lastAction || timestamp) && (
            <div style={{
              fontSize: "11px",
              fontFamily: "'IBM Plex Mono', monospace",
              color: tokens.textSecondary,
              borderTop: `1px solid ${tokens.borderSubtle}`,
              paddingTop: "5px",
              marginTop: "4px",
              display: "flex",
              justifyContent: "space-between",
            }}>
              {lastAction && <span>Last: {lastAction}</span>}
              {timestamp && <span>{timestamp.toLocaleTimeString()}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Carbon-style Button
function CarbonButton({ children, onClick, disabled, variant = "primary", size = "md", icon, danger }) {
  const [pressed, setPressed] = useState(false);

  const heights = { sm: "32px", md: "40px", lg: "48px", xl: "64px" };
  const paddings = { sm: "0 15px", md: "0 15px", lg: "0 15px", xl: "0 24px" };
  const fontSizes = { sm: "14px", md: "14px", lg: "16px", xl: "16px" };

  let bg, fg, border, hoverBg;
  if (danger) {
    bg = tokens.supportError; fg = tokens.textOnColor;
    hoverBg = "#b81922"; border = "none";
  } else if (variant === "primary") {
    bg = tokens.interactive; fg = tokens.textOnColor;
    hoverBg = tokens.interactiveHover; border = "none";
  } else if (variant === "secondary") {
    bg = tokens.layer02; fg = tokens.textPrimary;
    hoverBg = tokens.layer03; border = `1px solid ${tokens.borderSubtle}`;
  } else if (variant === "ghost") {
    bg = "transparent"; fg = tokens.interactive;
    hoverBg = "rgba(15,98,254,0.12)"; border = "none";
  } else if (variant === "tertiary") {
    bg = "transparent"; fg = tokens.interactive;
    hoverBg = "rgba(15,98,254,0.08)";
    border = `1px solid ${tokens.interactive}`;
  }

  if (disabled) {
    bg = tokens.layer03; fg = tokens.textDisabled; border = "none"; hoverBg = bg;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        height: heights[size],
        padding: paddings[size],
        background: pressed && !disabled ? hoverBg : bg,
        color: fg,
        border: border || "none",
        borderRadius: "0",
        fontSize: fontSizes[size],
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: "400",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 70ms cubic-bezier(0.2,0,0.38,0.9), box-shadow 70ms",
        outline: "none",
        boxSizing: "border-box",
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        minWidth: size === "xl" ? "160px" : "auto",
      }}
      onFocus={e => e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${tokens.focus}`}
      onBlur={e => e.currentTarget.style.boxShadow = "none"}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {children}
    </button>
  );
}

// Inline notification (Carbon pattern)
function InlineNotification({ kind, title, subtitle, onClose }) {
  const kinds = {
    error: { bg: "rgba(250,77,86,0.12)", border: tokens.supportError, icon: <IconWarning />, color: tokens.supportError },
    warning: { bg: "rgba(241,194,27,0.10)", border: tokens.supportWarning, icon: <IconWarning />, color: tokens.supportWarning },
    info: { bg: "rgba(69,137,255,0.10)", border: tokens.supportInfo, icon: null, color: tokens.supportInfo },
    success: { bg: "rgba(66,190,101,0.10)", border: tokens.supportSuccess, icon: <IconCheckmark />, color: tokens.supportSuccess },
  };
  const k = kinds[kind] || kinds.info;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      padding: "12px 16px",
      background: k.bg,
      borderLeft: `3px solid ${k.border}`,
      marginBottom: "16px",
    }}>
      <span style={{ color: k.color, marginTop: "1px", flexShrink: 0 }}>{k.icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{ color: tokens.textPrimary, fontSize: "14px", fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: "600" }}>
          {title}&nbsp;
        </span>
        <span style={{ color: tokens.textSecondary, fontSize: "14px", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {subtitle}
        </span>
      </div>
      {onClose && (
        <button onClick={onClose} style={{ background: "none", border: "none", color: tokens.iconSecondary, cursor: "pointer", padding: "0", fontSize: "16px", lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

// Progress bar (Carbon pattern)
function ProgressBar({ progress, state }) {
  const color = state === DOOR_STATE.OBSTRUCTION ? tokens.supportError
    : state === DOOR_STATE.STOPPED ? tokens.supportWarning
    : tokens.interactive;

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", color: tokens.textSecondary, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Door position
        </span>
        <span style={{ fontSize: "12px", color: tokens.textSecondary, fontFamily: "'IBM Plex Mono', monospace" }}>
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div style={{ height: "4px", background: tokens.layer02, position: "relative" }}>
        <div style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: color,
          transition: "width 200ms linear, background 0.2s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function GarageDoorControl({
  doorId = "Main Garage",
  initialState = DOOR_STATE.CLOSED,
  onStateChange,
}) {
  const [doorState, setDoorState] = useState(initialState);
  const [progress, setProgress] = useState(
    initialState === DOOR_STATE.OPEN ? 1 : 0
  );
  const [lastAction, setLastAction] = useState(null);
  const [timestamp, setTimestamp] = useState(new Date());

  const timerRef = useRef(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const isMoving = doorState === DOOR_STATE.OPENING || doorState === DOOR_STATE.CLOSING;
  const isOpen = doorState === DOOR_STATE.OPEN;
  const isClosed = doorState === DOOR_STATE.CLOSED;
  const isObstructed = doorState === DOOR_STATE.OBSTRUCTION;

  const updateState = (newState) => {
    setDoorState(newState);
    setTimestamp(new Date());
    onStateChange?.(newState);
  };

  const startMotion = (direction) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const targetProgress = direction === "open" ? 1 : 0;
    const startProgress = progressRef.current;
    const delta = targetProgress - startProgress;
    const steps = 50;
    const interval = (DOOR_TRAVEL_MS * Math.abs(delta)) / steps;
    let step = 0;

    updateState(direction === "open" ? DOOR_STATE.OPENING : DOOR_STATE.CLOSING);
    setLastAction(direction === "open" ? "Open" : "Close");

    timerRef.current = setInterval(() => {
      step++;
      const newProgress = startProgress + (delta * step) / steps;
      setProgress(Math.min(1, Math.max(0, newProgress)));

      // Simulate random obstruction (5% chance per cycle for demo)
      if (direction === "closing" && Math.random() < 0.004 && step > 5) {
        clearInterval(timerRef.current);
        updateState(DOOR_STATE.OBSTRUCTION);
        // Reverse: open back up
        setTimeout(() => startMotion("open"), 500);
        return;
      }

      if (step >= steps) {
        clearInterval(timerRef.current);
        setProgress(targetProgress);
        updateState(targetProgress === 1 ? DOOR_STATE.OPEN : DOOR_STATE.CLOSED);
        setNotification({
          kind: targetProgress === 1 ? "success" : "info",
          title: targetProgress === 1 ? "Door open." : "Door closed.",
          subtitle: `Completed at ${new Date().toLocaleTimeString()}.`,
        });
      }
    }, interval);
  };

  const handleStop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    updateState(DOOR_STATE.STOPPED);
    setLastAction("Stop");
    setNotification({
      kind: "warning",
      title: "Door stopped.",
      subtitle: `Position held at ${Math.round(progressRef.current * 100)}%.`,
    });
  };

  const handlePartialOpen = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const targetProgress = 0.35;
    const startProgress = progressRef.current;
    const delta = targetProgress - startProgress;
    if (Math.abs(delta) < 0.02) return;

    const steps = 30;
    const direction = delta > 0 ? DOOR_STATE.OPENING : DOOR_STATE.CLOSING;
    const interval = (DOOR_TRAVEL_MS * Math.abs(delta)) / steps;
    let step = 0;

    updateState(direction);
    setLastAction("Partial");

    timerRef.current = setInterval(() => {
      step++;
      const newProgress = startProgress + (delta * step) / steps;
      setProgress(Math.min(1, Math.max(0, newProgress)));
      if (step >= steps) {
        clearInterval(timerRef.current);
        setProgress(targetProgress);
        updateState(DOOR_STATE.STOPPED);
      }
    }, interval);
  };

  const handlePrimary = () => {
    if (isMoving) {
      handleStop();
    } else if (isClosed || doorState === DOOR_STATE.STOPPED) {
      startMotion("open");
    } else if (isOpen) {
      startMotion("closing");
    } else if (isObstructed) {
      startMotion("open");
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const primaryLabel = isMoving ? "Stop" : isClosed ? "Open Door" : isOpen ? "Close Door" :
    doorState === DOOR_STATE.STOPPED ? "Resume / Open" : "Open Door";
  const primaryIcon = isMoving ? <IconStop /> : isClosed ? <IconChevronUp /> : isOpen ? <IconChevronDown /> : <IconChevronUp />;
  const primaryVariant = isMoving ? "tertiary" : isObstructed ? "ghost" : "primary";
  const primaryDanger = isMoving;

  return (
    // Outer div = $background (#161616) — your dashboard page shell.
    // In production, remove this wrapper; drop the card div directly into your tile/panel.
    <div style={{
      background: tokens.background,
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;600&display=swap');
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; } 50% { box-shadow: 0 0 0 4px currentColor; opacity: 0.5; } }
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid ${tokens.focus}; outline-offset: -2px; }
      `}</style>

      {/* Card = $layer-01 (#262626) — matches your dashboard panel background */}
      <div style={{
        width: "100%",
        maxWidth: "360px",
        background: tokens.layer01,
        padding: "24px",
        border: `1px solid ${tokens.borderSubtle}`,
      }}>

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: `1px solid ${tokens.borderSubtle}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: tokens.iconSecondary }}><IconGarage /></span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: tokens.textPrimary, letterSpacing: "0.01em" }}>
                {doorId}
              </div>
              <div style={{ fontSize: "11px", color: tokens.textSecondary, fontFamily: "'IBM Plex Mono', monospace", marginTop: "2px" }}>
                {timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
          <StatusBadge doorState={doorState} lastAction={lastAction} timestamp={timestamp} />
        </div>

{/* Door schematic — $layer-02 inset within the $layer-01 card */}
        <div style={{
          background: tokens.layer02,
          padding: "24px 16px 16px",
          marginBottom: "16px",
          border: `1px solid ${tokens.borderSubtle}`,
        }}>
          <DoorSchematic doorState={doorState} progress={progress} />
        </div>

        {/* Progress bar */}
        <ProgressBar progress={progress} state={doorState} />

        {/* Primary action */}
        <div style={{ marginBottom: "8px" }}>
          <CarbonButton
            onClick={handlePrimary}
            variant={primaryVariant}
            size="xl"
            icon={primaryIcon}
            danger={primaryDanger}
            disabled={false}
          >
            {primaryLabel}
          </CarbonButton>
        </div>

        {/* Secondary actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: tokens.borderSubtle }}>
          <CarbonButton
            onClick={handlePartialOpen}
            variant="secondary"
            size="lg"
            disabled={isMoving}
          >
            Ventilate (35%)
          </CarbonButton>
          <CarbonButton
            onClick={handleStop}
            variant="secondary"
            size="lg"
            icon={<IconStop />}
            disabled={!isMoving}
          >
            Stop
          </CarbonButton>
        </div>

        {/* Footer meta */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: `1px solid ${tokens.borderSubtle}`,
        }}>
          <span style={{ fontSize: "11px", color: tokens.textSecondary, fontFamily: "'IBM Plex Mono', monospace" }}>
            Last: {lastAction ?? "—"}
          </span>
          <span style={{ fontSize: "11px", color: tokens.textSecondary, fontFamily: "'IBM Plex Mono', monospace" }}>
            ID · GDU-01
          </span>
        </div>
      </div> {/* end card ($layer-01) */}
    </div>   // end page wrapper ($background)
  );
}
