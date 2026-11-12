import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HOLIDAY_REGIONS } from '@/core/holidays';
import type { HolidayRegion } from '@/core/holidays';
import { toLocalDateString } from '@/core/time';
import { addCustomHoliday, deleteCustomHoliday, listHolidays, setHolidayEnabled, switchHolidayRegion } from '@/db/holidays';
import type { TKey } from '@/i18n';
import { useApp } from '@/state/AppProvider';
import { useActions, useDayKey, useI18n, useQuery, useTheme } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { DateTimeField } from '@/ui/DateTimeField';
import { SwitchRow, TextField } from '@/ui/Fields';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { Card, Chip, IconButton, SectionTitle } from '@/ui/Surface';
import { Text } from '@/ui/Text';

export default function HolidaysScreen() {
  const { t, fmt } = useI18n();
  const { colors } = useTheme();
  const { settings, updateSetting } = useApp();
  const { run } = useActions();
  const today = useDayKey();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [newDate, setNewDate] = useState(() => new Date().setHours(12, 0, 0, 0));
  const [newName, setNewName] = useState('');
  const { data } = useQuery((db) => listHolidays(db, `${year}-01-01`, `${year}-12-31`), [year]);
  const holidays = data ?? [];

  const changeRegion = async (region: HolidayRegion) => {
    const nowYear = new Date().getFullYear();
    const res = await run((db) => switchHolidayRegion(db, region, nowYear - 2, nowYear + 5));
    if (res.ok) await updateSetting('holidayRegion', region);
  };

  const onAdd = async () => {
    const res = await run((db) => addCustomHoliday(db, toLocalDateString(newDate), newName));
    if (res.ok) setNewName('');
  };

  return (
    <Screen variant="stack" keyboard title={t('holidays.title')}>
      <Text variant="label" color="textSecondary">
        {t('holidays.help')}
      </Text>
      <SectionTitle>{t('holidays.region')}</SectionTitle>
      <View style={styles.wrapRow}>
        {HOLIDAY_REGIONS.map((r) => (
          <Chip key={r} label={t(`holidays.region.${r}` as TKey)} selected={settings.holidayRegion === r} onPress={() => void changeRegion(r)} />
        ))}
      </View>

      <SectionTitle
        right={
          <View style={styles.yearNav}>
            <IconButton icon="chevron-left" label={`${t('holidays.year')} −`} onPress={() => setYear((y) => y - 1)} size={18} />
            <Text variant="bodyStrong" tabular>
              {year}
            </Text>
            <IconButton icon="chevron-right" label={`${t('holidays.year')} +`} onPress={() => setYear((y) => y + 1)} size={18} />
          </View>
        }>
        {t('settings.holidays')}
      </SectionTitle>
      <Card>
        {holidays.length === 0 ? (
          <Text variant="body" color="textSecondary">
            {t('holidays.empty')}
          </Text>
        ) : (
          holidays.map((h, i) => (
            <View key={h.id} style={styles.holidayRow}>
              <View style={styles.flex}>
                <SwitchRow
                  title={h.key ? t(`holiday.${h.key}` as TKey) : h.name}
                  subtitle={fmt.dateMediumCivil(h.date)}
                  value={h.isEnabled}
                  onValueChange={(v) => void run((db) => setHolidayEnabled(db, h.id, v))}
                  last={i === holidays.length - 1}
                />
              </View>
              {h.isCustom ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} hitSlop={10} onPress={() => void run((db) => deleteCustomHoliday(db, h.id))}>
                  <Icon name="trash-2" size={18} color={colors.negative} />
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </Card>

      <SectionTitle>{t('holidays.custom')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          <DateTimeField dateOnly label={t('common.date')} value={newDate} onChange={setNewDate} />
          <TextField label={t('common.name')} value={newName} onChangeText={setNewName} placeholder={t('holidays.namePlaceholder')} />
          <Button label={t('holidays.addCustom')} icon="plus" variant="secondary" onPress={onAdd} disabled={newName.trim().length === 0} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: spacing.lg },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  yearNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  holidayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
