import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CSV_COLUMNS, buildShiftsCsv } from '@/core/csv';
import type { CsvColumn, CsvDialect } from '@/core/csv';
import { addMonthsToDateString, toLocalDateString } from '@/core/time';
import { listEmployers } from '@/db/employers';
import type { TKey } from '@/i18n';
import { loadExportRows } from '@/services/data';
import { shareCsv, writeCsvToCache } from '@/services/exportCsv';
import { useApp } from '@/state/AppProvider';
import { useI18n, useQuery } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Segmented } from '@/ui/Fields';
import { Screen } from '@/ui/Screen';
import { Card, Chip } from '@/ui/Surface';
import { Text } from '@/ui/Text';

type Range = 'month' | 'year' | 'last12' | 'all';

export default function ExportScreen() {
  const { t } = useI18n();
  const { db, settings, updateSetting } = useApp();
  const { data: employers } = useQuery((d) => listEmployers(d, { includeArchived: true }));
  const [range, setRange] = useState<Range>('year');
  const [employerId, setEmployerId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onExport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const today = toLocalDateString(Date.now());
      const fromDate = range === 'month' ? `${today.slice(0, 7)}-01` : range === 'year' ? `${today.slice(0, 4)}-01-01` : range === 'last12' ? addMonthsToDateString(today, -12) : undefined;
      const rows = await loadExportRows(db, { fromDate, employerId });
      if (rows.length === 0) {
        setMessage(t('export.empty'));
        return;
      }
      const headers = Object.fromEntries(CSV_COLUMNS.map((c) => [c, t(`csv.${c}` as TKey)])) as Record<CsvColumn, string>;
      const csv = buildShiftsCsv(rows, headers, settings.csvFormat as CsvDialect);
      const uri = await writeCsvToCache(csv, `workearn-shifts-${today}.csv`);
      const result = await shareCsv(uri, t('export.title'));
      if (result === 'unavailable') setMessage(t('export.unavailable'));
    } catch {
      setMessage(t('export.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen variant="stack" title={t('export.title')} footer={<Button label={t('export.button')} icon="share-2" onPress={onExport} loading={busy} fullWidth />}>
      <Card>
        <View style={styles.stack}>
          <Segmented
            label={t('export.range')}
            value={range}
            onChange={setRange}
            options={[
              { value: 'month', label: t('export.range.month') },
              { value: 'year', label: t('export.range.year') },
              { value: 'last12', label: t('export.range.last12') },
              { value: 'all', label: t('export.range.all') },
            ]}
          />
          <View style={styles.stackSmall}>
            <Text variant="label" color="textSecondary">
              {t('export.employer')}
            </Text>
            <View style={styles.wrapRow}>
              <Chip label={t('common.all')} selected={employerId === null} onPress={() => setEmployerId(null)} />
              {(employers ?? []).map((e) => (
                <Chip key={e.id} label={e.name} color={e.color} selected={employerId === e.id} onPress={() => setEmployerId(e.id)} />
              ))}
            </View>
          </View>
          <Segmented
            label={t('export.format')}
            value={settings.csvFormat}
            onChange={(v) => void updateSetting('csvFormat', v)}
            options={[
              { value: 'semicolon', label: 'Excel (;)' },
              { value: 'comma', label: 'CSV (,)' },
            ]}
          />
          <Text variant="caption" color="textSecondary">
            {settings.csvFormat === 'semicolon' ? t('export.format.semicolon') : t('export.format.comma')}
          </Text>
        </View>
      </Card>
      <Text variant="label" color="textSecondary">
        {t('export.help')}
      </Text>
      {message ? (
        <Text variant="bodyStrong" color="warning">
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  stackSmall: { gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
