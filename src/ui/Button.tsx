import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/state/hooks';
import { MIN_TOUCH, radius } from '@/theme/tokens';

import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Text } from './Text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, size = 'md', fullWidth, accessibilityLabel }: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const palette = {
    primary: { bg: colors.accentStrong, fg: colors.onAccent, border: 'transparent' },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: 'transparent' },
    danger: { bg: colors.negative, fg: '#FFFFFF', border: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        scale.set(withTiming(0.97, { duration: 90 }));
      }}
      onPressOut={() => {
        scale.set(withTiming(1, { duration: 140 }));
      }}
      style={fullWidth ? styles.full : undefined}>
      <Animated.View
        style={[
          styles.base,
          { backgroundColor: palette.bg, borderColor: palette.border, minHeight: size === 'lg' ? 60 : MIN_TOUCH, opacity: inactive ? 0.5 : 1 },
          size === 'lg' && styles.lg,
          animated,
        ]}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <View style={styles.content}>
            {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} color={palette.fg} /> : null}
            <Text variant={size === 'lg' ? 'heading' : 'bodyStrong'} color={palette.fg}>
              {label}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  base: { borderRadius: radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  lg: { borderRadius: radius.lg },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
