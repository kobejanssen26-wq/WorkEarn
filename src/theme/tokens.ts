/**
 * Design tokens: palettes, spacing, radii and typography. Emerald accent, deep charcoal dark theme, clean white light theme.
 * Text colours meet WCAG AA (4.5:1) on bg, surface and surfaceAlt in both themes (ratios checked when the palette was set).
 */

export interface Palette {
  isDark: boolean;
  /** Screen background. */
  bg: string;
  /** Cards. */
  surface: string;
  /** Inputs, chips, subtle fills. */
  surfaceAlt: string;
  /** Raised surfaces: sheets, dialogs. */
  raised: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  /** Filled buttons. */
  accentStrong: string;
  accentSoft: string;
  /** Text/icon colour on `accentStrong`. */
  onAccent: string;
  positive: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  overlay: string;
  /** Gradient of the live earnings card. */
  hero: readonly [string, string];
  heroText: string;
  heroTextMuted: string;
  tabBar: string;
}

export const lightPalette: Palette = {
  isDark: false,
  bg: '#FFFFFF',
  surface: '#F5F8F6',
  surfaceAlt: '#EAF0EC',
  raised: '#FFFFFF',
  border: '#E2E9E5',
  text: '#0E1A14',
  textSecondary: '#3F5047',
  textTertiary: '#5B6B63',
  accent: '#047857',
  accentStrong: '#047857',
  accentSoft: '#D6F5E6',
  onAccent: '#FFFFFF',
  positive: '#047857',
  negative: '#C62828',
  negativeSoft: '#FDE8E8',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  overlay: 'rgba(8, 16, 12, 0.45)',
  hero: ['#064E3B', '#077C59'],
  heroText: '#FFFFFF',
  heroTextMuted: 'rgba(255,255,255,0.9)',
  tabBar: '#FFFFFF',
};

export const darkPalette: Palette = {
  isDark: true,
  bg: '#0F1113',
  surface: '#171A1D',
  surfaceAlt: '#20252A',
  raised: '#1D2125',
  border: '#2A3036',
  text: '#F1F5F3',
  textSecondary: '#A2AFA8',
  textTertiary: '#8A968F',
  accent: '#34D399',
  accentStrong: '#10B981',
  accentSoft: '#12332A',
  onAccent: '#04130C',
  positive: '#34D399',
  negative: '#F87171',
  negativeSoft: '#3A1B1D',
  warning: '#FBBF24',
  warningSoft: '#3A2F12',
  overlay: 'rgba(0, 0, 0, 0.62)',
  hero: ['#053D2E', '#06684B'],
  heroText: '#FFFFFF',
  heroTextMuted: 'rgba(255,255,255,0.9)',
  tabBar: '#13161A',
};

/** Colours offered for employers; distinct in both themes. */
export const EMPLOYER_COLORS = ['#10B981', '#0EA5E9', '#8B5CF6', '#F59E0B', '#F43F5E', '#14B8A6', '#F97316', '#6366F1'] as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'number';

export interface TextStyleSpec {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const typography: Record<TextVariant, TextStyleSpec> = {
  display: { fontFamily: fontFamily.bold, fontSize: 48, lineHeight: 56, letterSpacing: -1.5 },
  title: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  number: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
};

export const MIN_TOUCH = 48;
