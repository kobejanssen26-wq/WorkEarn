import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { startOfMonthDateString } from '@/core/time';
import { listEmployers } from '@/db/employers';
import type { EmployerWithRule } from '@/db/employers';
import { listShifts } from '@/db/shifts';
import type { ShiftRecord } from '@/db/shifts';
import { useI18n, useQuery } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Chip, ChipRow, EmptyState, IconButton, SectionTitle } from '@/ui/Surface';
import { Text } from '@/ui/Text';

import { ShiftCard } from './ShiftCard';

interface Section {
  key: string;
  title: string;
  total: number;
  /** Set when every shift of the month uses the same currency (otherwise a total would be meaningless). */
  currency: string | null;
  shifts: ShiftRecord[];
}

export default function HistoryScreen() {
  const router = useRouter();
  const { t, tp, fmt } = useI18n();
  const [employerFilter, setEmployerFilter] = useState<number | null>(null);
  const { data } = useQuery(async (db) => {
    const employers = await listEmployers(db, { includeArchived: true });
    const shifts = await listShifts(db, { includeActive: true, order: 'desc' });
    return { employers, shifts };
  });

  const employers = useMemo(() => new Map((data?.employers ?? []).map((e) => [e.id, e] as const)), [data]);
  const sections = useMemo<Section[]>(() => {
    const map = new Map<string, Section>();
    for (const s of data?.shifts ?? []) {
      if (employerFilter !== null && s.employerId !== employerFilter) continue;
      const key = startOfMonthDateString(s.localDate);
      const section = map.get(key) ?? { key, title: fmt.monthYearCivil(key), total: 0, currency: s.currency, shifts: [] };
      if (section.currency !== s.currency) section.currency = null;
      section.total += s.totalCents ?? 0;
      section.shifts.push(s);
      map.set(key, section);
    }
    return [...map.values()];
  }, [data, employerFilter, fmt]);

  const total = sections.reduce((n, s) => n + s.shifts.length, 0);

  return (
    <Screen title={t('history.title')} subtitle={tp('history.shiftCount', total)} right={<IconButton icon="plus" label={t('history.addShift')} tone="accent" onPress={() => router.push(`/shift/new${employerFilter ? `?employerId=${employerFilter}` : ''}`)} />}>
      {(data?.employers.length ?? 0) > 1 ? (
        <ChipRow>
          <Chip label={t('common.all')} selected={employerFilter === null} onPress={() => setEmployerFilter(null)} />
          {(data?.employers ?? []).map((e: EmployerWithRule) => (
            <Chip key={e.id} label={e.name} color={e.color} selected={employerFilter === e.id} onPress={() => setEmployerFilter(e.id)} />
          ))}
        </ChipRow>
      ) : null}

      {total === 0 ? (
        <EmptyState icon="clock" title={t('history.empty.title')} body={t('history.empty.body')} action={<Button label={t('history.addShift')} icon="plus" onPress={() => router.push('/shift/new')} />} />
      ) : (
        sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <SectionTitle
              right={
                section.currency ? (
                  <Text variant="label" color="textSecondary" tabular>
                    {fmt.money(section.total, section.currency)}
                  </Text>
                ) : undefined
              }>
              {section.title}
            </SectionTitle>
            <View style={styles.list}>
              {section.shifts.map((s) => (
                <ShiftCard key={s.id} shift={s} employer={employers.get(s.employerId)} currency={s.currency} onPress={() => (s.endAt === null ? router.navigate('/') : router.push(`/shift/${s.id}`))} />
              ))}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 0 },
  list: { gap: spacing.md },
});
