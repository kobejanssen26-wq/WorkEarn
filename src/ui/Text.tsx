import { Text as RNText } from 'react-native';
import type { TextProps as RNTextProps, TextStyle } from 'react-native';

import { useTheme } from '@/state/hooks';
import { typography } from '@/theme/tokens';
import type { Palette, TextVariant } from '@/theme/tokens';

export type TextColor = Exclude<keyof Palette, 'isDark' | 'hero'>;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** A palette key, or any colour string. */
  color?: TextColor | (string & {});
  /** Fixed-width digits so live numbers do not jitter. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color = 'text', tabular, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const palette = colors as unknown as Record<string, unknown>;
  const resolved = typeof palette[color] === 'string' ? (palette[color] as string) : color;
  const spec = typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        { fontFamily: spec.fontFamily, fontSize: spec.fontSize, lineHeight: spec.lineHeight, letterSpacing: spec.letterSpacing, color: resolved, textAlign: align },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
