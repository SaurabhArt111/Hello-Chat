export const callTheme = {
  colors: {
    background: "#0A0A0F",
    primaryAction: "#00C853",
    dangerAction: "#F44336",
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.6)",
    controlGlass: "rgba(255,255,255,0.10)",
    controlBorder: "rgba(255,255,255,0.15)",
  },
  typography: {
    callerName: {
      fontSize: 28,
      fontWeight: 600,
    },
    status: {
      fontSize: 16,
      fontWeight: 400,
      letterSpacing: 0.5,
    },
    timer: {
      fontSize: 14,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontVariantNumeric: "tabular-nums",
    },
  },
  controlStyles: {
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.10)",
  },
};

export const CALL_STATES = {
  IDLE: "idle",
  RINGING: "ringing",
  CONNECTING: "connecting",
  ACTIVE: "active",
  ENDED: "ended",
};
