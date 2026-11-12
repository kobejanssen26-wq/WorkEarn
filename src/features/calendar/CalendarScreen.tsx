import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dailyTotals } from '@/core/stats';
import type { StatShift } from '@/core/stats';
import {
  addDaysToDateString,
  addMonthsToDateString,
  formatDurationShort,
  monthKey,
  startOfMonthDateString,
  startOfWeekDateString,
} from '@/core/time';
import { listEmployers } from '@/db/employers';
import { listHolidays } from '@/db/holidays';
import { listShifts } from '@/db/shifts';
import { CurrencyChips, useCurrencyChoice } from '@/features/shared/currency';
import { ShiftCard } from '@/features/shifts/ShiftCard';
import { useApp } from '@/state/AppProvider';
import { useDayKey, useI18n, useQuery, useTheme } from '@/state/hooks';
import type { TKey } from '@/i18n';
import { radius, spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Card, Chip, IconButton } from '@/ui/Surface';
import { Text } from '@/ui/Text';

const WEEKS = 6;

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, fmt } = useI18n();
  const { settings } = useApp();
  const today = useDayKey();
  const [month, setMonth] = useState(() => startOfMonthDateString(today));
  const [selected, setSelected] = useState(today);
  const [employerFilter, setEmployerFilter] = useState<number | null>(null);

  const gridStart = startOfWeekDateString(month, settings.weekStart);
  const gridEnd = addDaysToDateString(gridStart, WEEKS * 7 - 1);
  const { data } = useQuery(
    async (db) => ({
      employers: await listEmployers(db, { includeArchived: true }),
      shifts: await listShifts(db, { fromDate: gridStart, toDate: gridEnd, employerId: employerFilter, order: 'asc' }),
      holidays: await listHolidays(db, gridStart, gridEnd),
    }),
    [gridStart, gridEnd, employerFilter],
  );
  const employers = useMemo(() => new Map((data?.employers ?? []).map((e) => [e.id, e] as const)), [data]);
  const shifts = useMemo(() => data?.shifts ?? [], [data]);
  const holidayByDate = useMemo(() => new Map((data?.holidays ?? []).filter((h) => h.isEnabled).map((h) => [h.date, h] as const)), [data]);

  const currencies = useMemo(() => [...new Set(shifts.map((s) => s.currency))], [shifts]);
  const { currency, setCurrency } = useCurrencyChoice(currencies, settings.currency);
  const totals = useMemo(() => {
    const stat: StatShift[] = shifts.filter((s) => s.currency === currency).map((s) => ({ employerId: s.employerId, localDate: s.localDate, roundedMs: s.roundedMs ?? 0, totalCents: s.totalCents ?? 0 }));
    return dailyTotals(stat);
  }, [shifts, currency]);

  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDaysToDateString(gridStart, i));
  const weekdayOrder = Array.from({ length: 7 }, (_, i) => (settings.weekStart === 0 ? i : (i + 6) % 7));
  const selectedShifts = shifts.filter((s) => s.localDate === selected);
  const selectedTotal = totals.get(selected);
  const holiday = holidayByDate.get(selected);
  const currentMonth = monthKey(month);

  const goMonth = (delta: number) => {
    const next = addMonthsToDateString(month, delta);
    setMonth(next);
    setSelected(monthKey(today) === monthKey(next) ? today : next);
  };

  const holidayName = (key: string | null, name: string) => (key ? t(`holiday.${key}` as TKey) : name);

  return (
    <Screen
      title={t('calendar.title')}
      subtitle={fmt.monthYearCivil(month)}
      right={
        <>
          <IconButton icon="chevron-left" label="‹" onPress={() => goMonth(-1)} />
          <IconButton icon="chevron-right" label="›" onPress={() => goMonth(1)} />
        </>
      }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={t('calendar.today')}
          icon="crosshair"
          onPress={() => {
            setMonth(startOfMonthDateString(today));
            setSelected(today);
          }}
        />
        <Chip label={t('common.all')} selected={employerFilter === null} onPress={() => setEmployerFilter(null)} />
        {(data?.employers ?? []).map((e) => (
          <Chip key={e.id} label={e.name} color={e.color} selected={employerFilter === e.id} onPress={() => setEmployerFilter(e.id)} />
        ))}
      </ScrollView>
      <CurrencyChips currencies={currencies} value={currency} onChange={setCurrency} />

      <Card padded={false}>
        <View style={styles.grid}>
          <View style={styles.weekRow}>
            {weekdayOrder.map((d) => (
              <View key={d} style={styles.cellHead}>
                <Text variant="caption" color="textTertiary">
                  {fmt.weekdayShort(d)}
                </Text>
              </View>
            ))}
          </View>
          {Array.from({ length: WEEKS }, (_, w) => (
            <View key={w} style={styles.weekRow}>
              {days.slice(w * 7, w * 7 + 7).map((day) => {
                const inMonth = monthKey(day) === currentMonth;
                const total = totals.get(day);
                const isSelected = day === selected;
                const isToday = day === today;
                const dayShifts = shifts.filter((s) => s.localDate === day);
                const isHoliday = holidayByDate.has(day);
                const label = `${fmt.dateLongCivil(day)}${total ? `, ${dayShifts.length}, ${fmt.money(total.cents, currency)}` : ''}${isHoliday ? `, ${t('dayKind.holiday')}` : ''}`;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelected(day)}
                    style={[
                      styles.cell,
                      { borderColor: isSelected ? colors.accent : isToday ? colors.textTertiary : 'transparent', backgroundColor: isSelected ? colors.accentSoft : 'transparent', opacity: inMonth ? 1 : 0.38 },
                    ]}>
                    <Text variant="label" color={isToday ? 'accent' : 'text'} style={isToday && styles.bold}>
                      {Number(day.slice(8, 10))}
                    </Text>
                    {total ? (
                      <Text variant="caption" color="accent" numberOfLines={1} tabular style={styles.amount}>
                        {fmt.compactMoney(total.cents, currency)}
                      </Text>
                    ) : (
                      <View style={styles.amountSpacer} />
                    )}
                    <View style={styles.dots}>
                      {dayShifts.slice(0, 3).map((s) => (
                        <View key={s.id} style={[styles.dot, { backgroundColor: employers.get(s.employerId)?.color ?? colors.accent }]} />
                      ))}
                    </View>
                    {isHoliday ? <View style={[styles.holiday, { backgroundColor: colors.warning }]} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.dayHeader}>
          <View style={styles.flex}>
            <Text variant="heading">{fmt.dateLongCivil(selected)}</Text>
            {holiday ? (
              <Text variant="label" color="warning">
                {holidayName(holiday.key, holiday.name)}
              </Text>
            ) : null}
          </View>
          {selectedTotal ? (
            <View style={styles.dayTotal}>
              <Text variant="number" tabular>
                {fmt.money(selectedTotal.cents, currency, { hideCents: !settings.showCents })}
              </Text>
              <Text variant="label" color="textSecondary" tabular>
                {formatDurationShort(selectedTotal.ms, { h: t('common.unit.hour'), m: t('common.unit.minute') })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.dayList}>
          {selectedShifts.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('calendar.noShifts')}
            </Text>
          ) : (
            selectedShifts.map((s) => <ShiftCard key={s.id} shift={s} employer={employers.get(s.employerId)} currency={s.currency} showDate={false} onPress={() => (s.endAt === null ? router.navigate('/') : router.push(`/shift/${s.id}`))} />)
          )}
          <Button label={t('calendar.addShift')} icon="plus" variant="secondary" onPress={() => router.push(`/shift/new?date=${selected}${employerFilter ? `&employerId=${employerFilter}` : ''}`)} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { gap: spacing.sm, paddingRight: spacing.xl },
  grid: { padding: spacing.sm },
  weekRow: { flexDirection: 'row' },
  cellHead: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: spacing.sm },
  cell: { width: `${100 / 7}%`, height: 64, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6, borderRadius: radius.md, borderWidth: 1.5 },
  bold: { fontFamily: 'Inter_700Bold' },
  amount: { fontSize: 10, lineHeight: 13, fontFamily: 'Inter_600SemiBold' },
  amountSpacer: { height: 13 },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  holiday: { position: 'absolute', top: 5, right: 7, width: 6, height: 6, borderRadius: 3 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayTotal: { alignItems: 'flex-end' },
  dayList: { gap: spacing.md, marginTop: spacing.lg },
});
