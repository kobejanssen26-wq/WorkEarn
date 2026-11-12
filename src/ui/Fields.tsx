import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/state/hooks';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';

import { Text } from './Text';

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text variant="caption" color="negative">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
  error?: string | null;
  multiline?: boolean;
  prefix?: string;
  suffix?: string;
  maxLength?: number;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function TextField({ label, value, onChangeText, placeholder, keyboardType, hint, error, multiline, prefix, suffix, maxLength, autoFocus, style, accessibilityLabel }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      <View
        style={[
          styles.input,
          { backgroundColor: colors.surfaceAlt, borderColor: error ? colors.negative : focused ? colors.accent : 'transparent' },
          multiline && styles.multiline,
          style,
        ]}>
        {prefix ? (
          <Text variant="body" color="textSecondary">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={colors.accent}
          style={[styles.textInput, { color: colors.text }, multiline && { textAlignVertical: 'top', minHeight: 88 }]}
        />
        {suffix ? (
          <Text variant="body" color="textSecondary">
            {suffix}
          </Text>
        ) : null}
      </View>
    </Field>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: readonly SegmentOption<T>[]; value: T; onChange: (value: T) => void; label?: string }) {
  const { colors } = useTheme();
  return (
    <Field label={label}>
      <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="tablist">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segment, selected && { backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1 }]}>
              <Text variant="label" color={selected ? 'text' : 'textSecondary'} numberOfLines={1} style={selected && { fontFamily: 'Inter_600SemiBold' }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

export function SwitchRow({ title, subtitle, value, onValueChange, last }: { title: string; subtitle?: string; value: boolean; onValueChange: (value: boolean) => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.switchRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.switchText}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="label" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
        thumbColor={value ? "#FFFFFF" : colors.textTertiary}
        ios_backgroundColor={colors.surfaceAlt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: 1.5 },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  textInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, paddingVertical: 10 },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  segment: { flex: 1, minHeight: MIN_TOUCH - 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 6, borderColor: 'transparent', borderWidth: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  switchText: { flex: 1, gap: 2 },
});
