// Private Voices Design Tokens — Premium Dark / Glass / Luxe

export const colors = {
  surface: "#0F172A",
  surfaceSecondary: "#1E293B",
  surfaceTertiary: "#334155",
  surfaceElevated: "#1B2438",
  onSurface: "#F8FAFC",
  onSurfaceMuted: "#94A3B8",
  onSurfaceDim: "#64748B",

  brand: "#06B6D4",
  brandSoft: "rgba(6,182,212,0.15)",
  brandBorder: "rgba(6,182,212,0.35)",
  brandDeep: "#0284C7",
  brandGlow: "rgba(6,182,212,0.55)",

  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",

  glass: "rgba(30,41,59,0.72)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderStrong: "rgba(6,182,212,0.25)",
  divider: "rgba(255,255,255,0.06)",

  overlayScrim: "rgba(15,23,42,0.65)",
};

export const radii = {
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  pill: 999,
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const font = {
  h1: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.onSurface },
  h2: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.onSurface },
  h3: { fontSize: 20, fontWeight: "700" as const, color: colors.onSurface },
  title: { fontSize: 16, fontWeight: "600" as const, color: colors.onSurface },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.onSurface, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "500" as const, color: colors.onSurfaceMuted },
  small: { fontSize: 12, fontWeight: "500" as const, color: colors.onSurfaceDim },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    heavy: "800" as const,
  },
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  soft: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
};

export const gradients = {
  brand: ["#06B6D4", "#0284C7"] as const,
  brandSoft: ["rgba(6,182,212,0.25)", "rgba(2,132,199,0.05)"] as const,
  scrimTop: ["rgba(15,23,42,0)", "rgba(15,23,42,0.95)"] as const,
  scrimBottom: ["rgba(15,23,42,0.95)", "rgba(15,23,42,0)"] as const,
  cardTint: ["rgba(6,182,212,0.15)", "rgba(139,92,246,0.08)"] as const,
  pinkSoft: ["rgba(236,72,153,0.35)", "rgba(139,92,246,0.15)"] as const,
  emeraldSoft: ["rgba(16,185,129,0.35)", "rgba(6,182,212,0.15)"] as const,
  amberSoft: ["rgba(245,158,11,0.35)", "rgba(239,68,68,0.15)"] as const,
  violetSoft: ["rgba(139,92,246,0.35)", "rgba(6,182,212,0.15)"] as const,
};
