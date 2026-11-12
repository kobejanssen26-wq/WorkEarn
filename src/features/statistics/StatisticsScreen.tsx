import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { averageHourlyCents, buildBuckets, employerBreakdown } from '@/core/stats';
import type { Granularity, StatShift } from '@/core/stats';
import { addDaysToDateString, formatDurationShort, isoWeek, parseDateString, startOfMonthDateString } from '@/core/time';
import { listEmployers } from '@/db/employers';
import { listShifts } from '@/db/shifts';
import { CurrencyChips, useCurrencyChoice } from '@/features/shared/currency';
import { useApp } from '@/state/AppProvider';
import { useDayKey, useI18n, useQuery } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Segmented } from '@/ui/Fields';
import { Screen } from '@/ui/Screen';
import { Card, EmptyState, SectionTitle } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { BarChart, ShareBar } from '@/ui/charts';
import type { BarDatum } from '@/ui/charts';

type Range = 'month' | 'year' | 'all';

export default function StatisticsScreen() {
  const { t, fmt } = useI18n();
  const { settings } = useApp();
  const today = useDayKey();
  const [period, setPeriod] = useState<Granularity>('week');
  const [range, setRange] = useState<Range>('year');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data } = useQuery(async (db) => ({
    employers: await listEmployers(db, { includeArchived: true }),
    shifts: await listShifts(db, { order: 'asc' }),
  }));
  const shifts = useMemo(() => data?.shifts ?? [], [data]);
  const employers = useMemo(() => new Map((data?.employers ?? []).map((e) => [e.id, e] as const)), [data]);

  const currencies = useMemo(() => [...new Set(shifts.map((s) => s.currency))], [shifts]);
  const { currency, setCurrency } = useCurrencyChoice(currencies, settings.currency);
  const stat = useMemo<StatShift[]>(
    () => shifts.filter((s) => s.currency === currency).map((s) => ({ employerId: s.employerId, localDate: s.localDate, roundedMs: s.roundedMs ?? 0, totalCents: s.totalCents ?? 0 })),
    [shifts, currency],
  );

  const units = { h: t('common.unit.hour'), m: t('common.unit.minute') };
  const firstYear = stat[0] ? parseDateString(stat[0].localDate).y : parseDateString(today).y;
  const count = period === 'day' ? 14 : period === 'week' ? 12 : period === 'month' ? 12 : Math.min(8, Math.max(2, parseDateString(today).y - firstYear + 1));
  const buckets = useMemo(() => buildBuckets(stat, period, today, count, settings.weekStart), [stat, period, today, count, settings.weekStart]);

  const bucketLabel = (startDate: string, endDate: string): string => {
    switch (period) {
      case 'day':
        return fmt.dateMediumCivil(startDate);
      case 'week':
        return `${fmt.dateShortCivil(startDate)} – ${fmt.dateShortCivil(endDate)}`;
      case 'month':
        return fmt.monthYearCivil(startDate);
      default:
        return startDate.slice(0, 4);
    }
  };
  const bars: BarDatum[] = buckets.map((b, i) => ({
    key: b.key,
    label: period === 'day' ? String(Number(b.startDate.slice(8))) : period === 'week' ? String(isoWeek(b.startDate).week) : period === 'month' ? fmt.monthShortCivil(b.startDate) : b.startDate.slice(0, 4),
    tooltip: bucketLabel(b.startDate, b.endDate),
    value: b.cents,
    highlight: i === buckets.length - 1,
  }));

  const selected = buckets.find((b) => b.key === selectedKey) ?? buckets[buckets.length - 1];
  const isCurrent = selected === buckets[buckets.length - 1];
  const rangeStart = range === 'month' ? startOfMonthDateString(today) : range === 'year' ? `${today.slice(0, 4)}-01-01` : '0000-01-01';
  const rangeShifts = stat.filter((s) => s.localDate >= rangeStart && s.localDate <= addDaysToDateString(today, 3660));
  const comparison = employerBreakdown(rangeShifts);
  const hideCents = !settings.showCents;
  const money = (cents: number) => fmt.money(cents, currency, { hideCents });

  const tile = (label: string, value: string, hint?: string) => (
    <Card style={styles.tile}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </Card>
  );

  const hasData = shifts.length > 0;

  return (
    <Screen title={t('stats.title')}>
      {!hasData ? (
        <Card>
          <EmptyState icon="bar-chart-2" title={t('stats.empty.title')} body={t('stats.empty.body')} />
        </Card>
      ) : (
        <>
          <CurrencyChips currencies={currencies} value={currency} onChange={setCurrency} />
          <Segmented
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setSelectedKey(null);
            }}
            options={[
              { value: 'day', label: t('stats.period.day') },
              { value: 'week', label: t('stats.period.week') },
              { value: 'month', label: t('stats.period.month') },
              { value: 'year', label: t('stats.period.year') },
            ]}
          />

          <Card>
            <Text variant="label" color="textSecondary">
              {t(`stats.chart.${period}` as 'stats.chart.day')}
            </Text>
            <View style={styles.chart}>
              <BarChart data={bars} format={(v) => fmt.compactMoney(v, currency)} selectedKey={selectedKey} onSelect={(key) => setSelectedKey((k) => (k === key ? null : key))} />
            </View>
          </Card>

          <SectionTitle>{isCurrent ? t(`stats.current.${period}` as 'stats.current.day') : bucketLabel(selected!.startDate, selected!.endDate)}</SectionTitle>
          <View style={styles.tiles}>
            {tile(t('stats.earnings'), money(selected!.cents))}
            {tile(t('stats.hours'), formatDurationShort(selected!.ms, units))}
          </View>
          <View style={styles.tiles}>
            {tile(t('stats.avgHourly'), averageHourlyCents(selected!.cents, selected!.ms) === null ? '—' : `${money(averageHourlyCents(selected!.cents, selected!.ms) as number)}${t('common.perHour')}`)}
            {tile(t('stats.shifts'), String(selected!.shifts))}
          </View>
          <Text variant="caption" color="textSecondary">
            {t('stats.avgHourly.help')}
          </Text>

          <SectionTitle>{t('stats.employers.title')}</SectionTitle>
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: 'month', label: t('stats.range.month') },
              { value: 'year', label: t('stats.range.year') },
              { value: 'all', label: t('stats.range.all') },
            ]}
          />
          <Card>
            {comparison.length === 0 ? (
              <Text variant="body" color="textSecondary">
                {t('stats.empty.body')}
              </Text>
            ) : (
              <View style={styles.compare}>
                {comparison.map((c) => {
                  const employer = employers.get(c.employerId);
                  const top = comparison[0]?.cents ?? 1;
                  return (
                    <View key={c.employerId} style={styles.compareRow}>
                      <View style={styles.compareHead}>
                        <View style={styles.compareName}>
                          <View style={[styles.dot, { backgroundColor: employer?.color ?? '#999999' }]} />
                          <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                            {employer?.name ?? '—'}
                          </Text>
                        </View>
                        <Text variant="bodyStrong" tabular>
                          {money(c.cents)}
                        </Text>
                      </View>
                      <ShareBar fraction={top > 0 ? c.cents / top : 0} color={employer?.color ?? '#999999'} />
                      <Text variant="caption" color="textSecondary" tabular>
                        {t('stats.share', { percent: (c.shareTenths / 10).toFixed(c.shareTenths % 10 === 0 ? 0 : 1).replace('.', fmt.decimalSeparator) })} · {formatDurationShort(c.ms, units)} ·{' '}
                        {c.avgHourlyCents === null ? '—' : `${money(c.avgHourlyCents)}${t('common.perHour')}`} · {t('stats.shifts').toLowerCase()} {c.shifts}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chart: { marginTop: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: 4, padding: spacing.lg },
  compare: { gap: spacing.xl },
  compareRow: { gap: 8 },
  compareHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  compareName: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
