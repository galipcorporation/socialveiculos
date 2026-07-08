// Design tokens — Social Velocity (mesma paleta do apps/gestor, theme.css --sv-*).
// Dark = cinza neutro com elevação por luminosidade. Nunca hardcodar cor nas telas.

export interface ThemeColors {
  bg: string
  surface: string
  surfaceDim: string
  surfaceElevated: string
  inputBg: string
  text: string
  textDim: string
  textMuted: string
  border: string
  borderHover: string
  primary: string
  primaryText: string
  onPrimary: string
  secondary: string
  success: string
  warning: string
  error: string
  info: string
  overlaySoft: string
  overlay: string
  overlayStrong: string
  backdrop: string
  tabBar: string
  skeleton: string
  skeletonHighlight: string
}

export const darkColors: ThemeColors = {
  bg: '#121315',
  surface: '#1c1d20',
  surfaceDim: '#161719',
  surfaceElevated: '#26282c',
  inputBg: '#26282c',
  text: '#e8e9ea',
  textDim: '#a1a3a8',
  textMuted: '#888a90',
  border: 'rgba(255,255,255,0.09)',
  borderHover: 'rgba(255,255,255,0.18)',
  primary: '#3b82f6',
  primaryText: '#93b4ff',
  onPrimary: '#ffffff',
  secondary: '#fb923c',
  success: '#4ade80',
  warning: '#fb923c',
  error: '#f43f5e',
  info: '#7bd0ff',
  overlaySoft: 'rgba(255,255,255,0.04)',
  overlay: 'rgba(255,255,255,0.08)',
  overlayStrong: 'rgba(255,255,255,0.16)',
  backdrop: 'rgba(0,0,0,0.6)',
  tabBar: '#161719',
  skeleton: 'rgba(255,255,255,0.06)',
  skeletonHighlight: 'rgba(255,255,255,0.12)',
}

export const lightColors: ThemeColors = {
  bg: '#f1f5f9',
  surface: '#ffffff',
  surfaceDim: '#f1f5f9',
  surfaceElevated: '#ffffff',
  inputBg: '#f8fafc',
  text: '#0f172a',
  textDim: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderHover: '#cbd5e1',
  primary: '#2563eb',
  primaryText: '#1d4ed8',
  onPrimary: '#ffffff',
  secondary: '#ea580c',
  success: '#16a34a',
  warning: '#ea580c',
  error: '#dc2626',
  info: '#2563eb',
  overlaySoft: 'rgba(15,23,42,0.04)',
  overlay: 'rgba(15,23,42,0.07)',
  overlayStrong: 'rgba(15,23,42,0.14)',
  backdrop: 'rgba(15,23,42,0.45)',
  tabBar: '#ffffff',
  skeleton: 'rgba(15,23,42,0.06)',
  skeletonHighlight: 'rgba(15,23,42,0.12)',
}

// Escala 4pt
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const

// Hanken Grotesk para títulos/números, Inter para corpo (igual ao gestor)
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'HankenGrotesk_600SemiBold',
  displayBold: 'HankenGrotesk_700Bold',
  displayExtraBold: 'HankenGrotesk_800ExtraBold',
} as const

export const typography = {
  displayLg: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34 },
  display: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28 },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  bodySemibold: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  captionMedium: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
} as const
