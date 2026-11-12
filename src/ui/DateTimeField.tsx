import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n, useIs24Hour, useTheme } from '@/state/hooks';
import { radius, spacing } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

/** A tappable date + time pair that opens the native Android pickers. `value` is epoch milliseconds. */
export function DateTimeField({ label, value, onChange, dateOnly, timeOnly }: { label: string; value: number; onChange: (ms: number) => void; dateOnly?: boolean; timeOnly?: boolean }) {
  const { colors } = useTheme();
  const { fmt, t } = useI18n();
  const is24Hour = useIs24Hour();

  const pickDate = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        const current = new Date(value);
        onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), current.getHours(), current.getMinutes(), 0, 0).getTime());
      },
    });
  const pickTime = () =>
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'time',
      is24Hour,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        const current = new Date(value);
        onChange(new Date(current.getFullYear(), current.getMonth(), current.getDate(), date.getHours(), date.getMinutes(), 0, 0).getTime());
      },
    });

  const cell = (icon: 'calendar' | 'clock', text: string, onPress: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}. ${a11y}`}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, { backgroundColor: pressed ? colors.border : colors.surfaceAlt }]}>
      <Icon name={icon} size={16} color={colors.accent} />
      <Text variant="bodyStrong" tabular>
        {text}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View style={styles.row}>
        {timeOnly ? null : cell('calendar', fmt.dateMedium(value), pickDate, t('shift.pickDate'))}
        {dateOnly ? null : cell('clock', fmt.time(value), pickTime, t('shift.pickTime'))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1, minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});

/** A time of day (minutes after midnight) picked with the native time dialog. */
export function TimeOfDayField({ label, minute, onChange }: { label: string; minute: number; onChange: (minute: number) => void }) {
  const { colors } = useTheme();
  const { fmt } = useI18n();
  const is24Hour = useIs24Hour();
  const asDate = new Date(2024, 0, 1, Math.floor(minute / 60), minute % 60);
  const open = () =>
    DateTimePickerAndroid.open({
      value: asDate,
      mode: 'time',
      is24Hour,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(date.getHours() * 60 + date.getMinutes());
      },
    });
  return (
    <View style={[styles.wrap, { flex: 1 }]}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${fmt.time(asDate.getTime())}`} onPress={open} style={({ pressed }) => [styles.cell, { backgroundColor: pressed ? colors.border : colors.surfaceAlt }]}>
        <Icon name="clock" size={16} color={colors.accent} />
        <Text variant="bodyStrong" tabular>
          {fmt.time(asDate.getTime())}
        </Text>
      </Pressable>
    </View>
  );
}
