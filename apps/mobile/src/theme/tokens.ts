// Design tokens — Social Veículos Mobile (conceito visual próprio, distinto do apps/gestor).
// Base grafite/off-white com acento laranja de sinal. Nunca hardcodar cor nas telas.

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
  bg: '#111214',
  surface: '#1a1b1e',
  surfaceDim: '#161719',
  surfaceElevated: '#212327',
  inputBg: '#212327',
  text: '#f4f4f1',
  textDim: 'rgba(244,244,241,0.6)',
  textMuted: 'rgba(244,244,241,0.4)',
  border: 'rgba(255,255,255,0.09)',
  borderHover: 'rgba(255,255,255,0.18)',
  primary: '#e2542a',
  primaryText: '#ff8a5c',
  onPrimary: '#ffffff',
  secondary: '#c8471f',
  success: '#7ed3a8',
  warning: '#f0b429',
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
  bg: '#f2f2ef',
  surface: '#ffffff',
  surfaceDim: '#e7e7e3',
  surfaceElevated: '#ffffff',
  inputBg: '#ffffff',
  text: '#16181a',
  textDim: 'rgba(22,24,26,0.55)',
  textMuted: 'rgba(22,24,26,0.4)',
  border: '#e4e4df',
  borderHover: '#d4d4cf',
  primary: '#e2542a',
  primaryText: '#c8471f',
  onPrimary: '#ffffff',
  secondary: '#16181a',
  success: '#2e7d5b',
  warning: '#c8471f',
  error: '#dc2626',
  info: '#2b7fd6',
  overlaySoft: 'rgba(22,24,26,0.04)',
  overlay: 'rgba(22,24,26,0.07)',
  overlayStrong: 'rgba(22,24,26,0.14)',
  backdrop: 'rgba(22,24,26,0.5)',
  tabBar: '#ffffff',
  skeleton: 'rgba(22,24,26,0.06)',
  skeletonHighlight: 'rgba(22,24,26,0.12)',
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
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  full: 999,
} as const

// Space Grotesk para títulos/números de destaque, Manrope para interface,
// JetBrains Mono para labels/metadados curtos (conceito visual mobile 2026).
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  display: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_600SemiBold',
  displayExtraBold: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const

export const typography = {
  displayLg: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  display: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  bodySemibold: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  captionMedium: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  mono: { fontFamily: fonts.mono, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.3 },
  monoLabel: { fontFamily: fonts.monoMedium, fontSize: 9.5, lineHeight: 13, letterSpacing: 0.6 },
} as const
