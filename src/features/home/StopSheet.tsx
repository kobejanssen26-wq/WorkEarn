import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { calculateShift } from '@/core/engine';
import { formatDurationShort } from '@/core/time';
import { useI18n } from '@/state/hooks';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { Divider } from '@/ui/Surface';
import { Text } from '@/ui/Text';

import type { ActiveView } from './LiveHero';

/** Shows the live estimate next to the final (interval-rounded) earnings before a shift is stopped. */
export function StopSheet({ visible, stopAt, active, holidays, hideCents, onConfirm, onCancel, busy }: { visible: boolean; stopAt: number; active: ActiveView | null; holidays: ReadonlySet<string>; hideCents: boolean; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const { t, fmt } = useI18n();
  const result = useMemo(() => {
    if (!active) return null;
    const endAt = Math.max(stopAt, active.shift.startAt);
    const breaks = active.shift.breaks.map((b) => ({ startAt: b.startAt, endAt: b.endAt ?? endAt, isPaid: b.isPaid }));
    const base = { startAt: active.shift.startAt, endAt, breaks, rule: active.rule, holidays, adjustments: active.shift.adjustments };
    return { estimate: calculateShift(base, { estimate: true }), final: calculateShift(base) };
  }, [active, holidays, stopAt]);

  if (!active || !result) return <Sheet visible={false} onClose={onCancel}>{null}</Sheet>;
  const currency = active.rule.currency;
  const units = { h: t('common.unit.hour'), m: t('common.unit.minute') };
  const money = (cents: number) => fmt.money(cents, currency, { hideCents });
  const rounded = active.rule.intervalMinutes !== 0 && result.final.roundedMs !== result.estimate.paidMs;
  const roundingLabel = t('stop.rounding', {
    mode: t(`employer.rounding.${active.rule.roundingMode}` as 'employer.rounding.down').toLowerCase(),
    interval: t(`interval.${active.rule.intervalMinutes}` as 'interval.0').toLowerCase(),
  });

  const row = (label: string, value: string, strong = false) => (
    <View style={styles.row}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'text' : 'textSecondary'}>
        {label}
      </Text>
      <Text variant={strong ? 'heading' : 'bodyStrong'} tabular>
        {value}
      </Text>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onCancel} title={t('stop.title')}>
      {row(t('stop.worked'), formatDurationShort(result.final.grossMs, units))}
      {result.final.unpaidBreakMs > 0 ? row(t('stop.unpaidBreaks'), `− ${formatDurationShort(result.final.unpaidBreakMs, units)}`) : null}
      {row(t('stop.counted'), formatDurationShort(result.final.roundedMs, units))}
      {rounded ? (
        <Text variant="caption" color="textSecondary">
          {roundingLabel}
        </Text>
      ) : null}
      <Divider />
      {row(t('stop.estimated'), money(result.estimate.totalCents))}
      {result.final.fixedBonusCents + result.final.adjustmentsCents !== 0
        ? row(t('home.bonuses'), fmt.money(result.final.fixedBonusCents + result.final.adjustmentsCents, currency, { signDisplay: 'always', hideCents }))
        : null}
      {row(t('stop.final'), money(result.final.totalCents), true)}
      <View style={styles.buttons}>
        <Button label={t('stop.confirm')} icon="check" onPress={onConfirm} loading={busy} fullWidth />
        <Button label={t('stop.keep')} variant="ghost" onPress={onCancel} fullWidth />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  buttons: { gap: 8, marginTop: 8 },
});
