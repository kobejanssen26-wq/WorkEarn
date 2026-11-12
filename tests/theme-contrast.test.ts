import { darkPalette, lightPalette } from '@/theme/tokens';
import type { Palette } from '@/theme/tokens';

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (fg: RGB, bg: RGB, alpha: number): RGB => fg.map((v, i) => v * alpha + (bg[i] as number) * (1 - alpha)) as RGB;
const AA = 4.5;

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as [string, Palette][])('%s theme meets WCAG AA contrast', (_name, p) => {
  const surfaces = [p.bg, p.surface, p.surfaceAlt];

  it('keeps body, secondary, tertiary and accent text readable on every surface', () => {
    for (const bg of surfaces) {
      for (const text of [p.text, p.textSecondary, p.textTertiary, p.accent, p.negative]) {
        expect(contrast(rgb(text), rgb(bg))).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('keeps selected chips, filled buttons and status colours readable', () => {
    expect(contrast(rgb(p.accent), rgb(p.accentSoft))).toBeGreaterThanOrEqual(AA);
    expect(contrast(rgb(p.onAccent), rgb(p.accentStrong))).toBeGreaterThanOrEqual(AA);
    expect(contrast(rgb(p.warning), rgb(p.warningSoft))).toBeGreaterThanOrEqual(AA);
    expect(contrast(rgb(p.negative), rgb(p.negativeSoft))).toBeGreaterThanOrEqual(AA);
    const dangerText = p.isDark ? '#1A0606' : '#FFFFFF'; // must match src/ui/Button.tsx
    expect(contrast(rgb(dangerText), rgb(p.negative))).toBeGreaterThanOrEqual(AA);
  });

  it('keeps all text on the live earnings card readable along the whole gradient', () => {
    const [start, end] = [rgb(p.hero[0]), rgb(p.hero[1])];
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const bg = start.map((v, i) => v + ((end[i] as number) - v) * t) as RGB;
      expect(contrast([255, 255, 255], bg)).toBeGreaterThanOrEqual(AA);
      expect(contrast(mix([255, 255, 255], bg, 0.9), bg)).toBeGreaterThanOrEqual(AA); // muted hero text (alpha 0.9)
    }
  });
});
