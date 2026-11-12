import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { listEmployers } from '@/db/employers';
import type { EmployerWithRule } from '@/db/employers';
import { useI18n, useQuery } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Card, EmptyState, Pill, SectionTitle } from '@/ui/Surface';
import { Text } from '@/ui/Text';

import { premiumSummary } from './formModel';

export default function EmployersScreen() {
  const router = useRouter();
  const { t, fmt } = useI18n();
  const { data } = useQuery((db) => listEmployers(db, { includeArchived: true }));
  const employers = data ?? [];
  const activeList = employers.filter((e) => !e.isArchived);
  const archived = employers.filter((e) => e.isArchived);

  const card = (e: EmployerWithRule) => {
    const bonuses = premiumSummary(e.rule, (units) => `${fmt.rate(units, e.currency)}${t('common.perHour')}`);
    const extras = e.rule.customBonuses.length + e.rule.fixedBonuses.length;
    return (
      <Card key={e.id} onPress={() => router.push(`/employers/${e.id}`)} accessibilityLabel={e.name}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: e.color }]} />
          <View style={styles.flex}>
            <Text variant="heading" numberOfLines={1}>
              {e.name}
            </Text>
            <Text variant="label" color="textSecondary">
              {t('employers.rateSummary', { rate: fmt.rate(e.rule.hourlyRate, e.currency) })}
            </Text>
          </View>
        </View>
        {bonuses.length > 0 || extras > 0 || e.rule.intervalMinutes !== 0 ? (
          <View style={styles.pills}>
            {bonuses.map((b) => (
              <Pill key={b} label={b} tone="accent" />
            ))}
            {extras > 0 ? <Pill label={`+${extras}`} /> : null}
            {e.rule.intervalMinutes !== 0 ? <Pill label={t(`interval.${e.rule.intervalMinutes}` as 'interval.5')} /> : null}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen variant="stack" title={t('employers.title')} right={<Button label={t('common.add')} icon="plus" onPress={() => router.push('/employers/new')} />}>
      {employers.length === 0 ? (
        <EmptyState icon="briefcase" title={t('employers.empty.title')} body={t('employers.empty.body')} action={<Button label={t('employers.add')} icon="plus" onPress={() => router.push('/employers/new')} />} />
      ) : (
        <>
          {activeList.map(card)}
          {archived.length > 0 ? (
            <>
              <SectionTitle>{t('employers.archived')}</SectionTitle>
              {archived.map(card)}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 14, height: 14, borderRadius: 7 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
});
