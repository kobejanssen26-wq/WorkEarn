import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '@/state/hooks';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';

import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Text } from './Text';

export function Card({ children, onPress, style, padded = true, accessibilityLabel }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; padded?: boolean; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const base: StyleProp<ViewStyle> = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, padded && { padding: spacing.lg }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function IconButton({ icon, onPress, label, tone = 'default', size = 22 }: { icon: IconName; onPress: () => void; label: string; tone?: 'default' | 'accent' | 'danger'; size?: number }) {
  const { colors } = useTheme();
  const color = tone === 'accent' ? colors.accent : tone === 'danger' ? colors.negative : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color, icon }: { label: string; selected?: boolean; onPress?: () => void; color?: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.accentSoft : colors.surfaceAlt, borderColor: selected ? colors.accent : 'transparent' },
      ]}>
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {icon ? <Icon name={icon} size={16} color={selected ? colors.accent : colors.textSecondary} /> : null}
      <Text variant="label" color={selected ? 'accent' : 'textSecondary'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'warning' | 'hero' }) {
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.accentSoft : tone === 'warning' ? colors.warningSoft : tone === 'hero' ? 'rgba(255,255,255,0.18)' : colors.surfaceAlt;
  const fg = tone === 'accent' ? colors.accent : tone === 'warning' ? colors.warning : tone === 'hero' ? colors.heroText : colors.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text variant="caption" color={fg}>
        {label}
      </Text>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="caption" color="textSecondary" style={styles.upper}>
        {children}
      </Text>
      {right}
    </View>
  );
}

/** A tappable list row with optional icon, subtitle and trailing content. */
export function Row({
  title,
  subtitle,
  icon,
  right,
  onPress,
  tone,
  last,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  last?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: tone === 'danger' ? colors.negativeSoft : colors.accentSoft }]}>
          <Icon name={icon} size={18} color={tone === 'danger' ? colors.negative : colors.accent} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text variant="bodyStrong" color={tone === 'danger' ? 'negative' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && !right ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
      {content}
    </Pressable>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={28} color={colors.accent} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="body" color="textSecondary" align="center" style={styles.emptyBody}>
        {body}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1 },
  iconButton: { width: MIN_TOUCH - 4, height: MIN_TOUCH - 4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: radius.pill, borderWidth: 1.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.sm },
  upper: { textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyBody: { maxWidth: 320 },
});
