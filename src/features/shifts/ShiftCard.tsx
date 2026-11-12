import { StyleSheet, View } from 'react-native';

import { formatDurationShort, toLocalDateString } from '@/core/time';
import type { EmployerWithRule } from '@/db/employers';
import type { ShiftRecord } from '@/db/shifts';
import { useApp } from '@/state/AppProvider';
import { useI18n } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Card } from '@/ui/Surface';
import { Text } from '@/ui/Text';

/** One finished (or running) shift in a list. */
export function ShiftCard({ shift, employer, currency, onPress, showDate = true }: { shift: ShiftRecord; employer: EmployerWithRule | undefined; currency: string; onPress: () => void; showDate?: boolean }) {
  const { t, fmt } = useI18n();
  const { settings } = useApp();
  const running = shift.endAt === null;
  const units = { h: t('common.unit.hour'), m: t('common.unit.minute') };
  const nextDay = shift.endAt !== null && toLocalDateString(shift.endAt) !== toLocalDateString(shift.startAt);
  const name = employer?.name ?? '—';
  const timeText = `${fmt.time(shift.startAt)} – ${running ? t('shift.running') : fmt.time(shift.endAt as number)}${nextDay ? ' +1' : ''}`;
  const amount = shift.totalCents === null ? '—' : fmt.money(shift.totalCents, currency, { hideCents: !settings.showCents });
  const duration = shift.roundedMs === null ? '' : formatDurationShort(shift.roundedMs, units);

  return (
    <Card onPress={onPress} accessibilityLabel={`${name}, ${timeText}, ${amount}`}>
      <View style={styles.row}>
        <View style={[styles.bar, { backgroundColor: employer?.color ?? '#999999' }]} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="label" color="textSecondary" tabular>
            {showDate ? `${fmt.dateMediumCivil(shift.localDate)} · ` : ''}
            {timeText}
          </Text>
          {shift.notes ? (
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {shift.notes}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <Text variant="number" tabular>
            {amount}
          </Text>
          <Text variant="label" color="textSecondary" tabular>
            {duration}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bar: { width: 5, alignSelf: 'stretch', borderRadius: 3, minHeight: 40 },
  right: { alignItems: 'flex-end', gap: 2 },
});
