import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { calculateShift } from '@/core/engine';
import { currencySymbol, parseDecimal, centsToPlainString } from '@/core/money';
import { validateShiftTimes } from '@/core/payRule';
import { MS_PER_HOUR, formatDurationShort, localDateToMs, toLocalDateString } from '@/core/time';
import type { AdjustmentKind } from '@/core/types';
import { listEmployers } from '@/db/employers';
import type { EmployerWithRule } from '@/db/employers';
import { getEnabledHolidayDates } from '@/db/holidays';
import { loadPayRule } from '@/db/payRules';
import { getShiftDetail } from '@/db/shifts';
import type { ShiftDetail } from '@/db/shifts';
import type { TKey } from '@/i18n';
import { deleteShift, saveShift } from '@/services/shifts';
import { errorMessage, useActions, useDayKey, useI18n, useQuery, useTheme } from '@/state/hooks';
import { radius, spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { DateTimeField } from '@/ui/DateTimeField';
import { Segmented, TextField } from '@/ui/Fields';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { Card, Chip, Divider, EmptyState, SectionTitle } from '@/ui/Surface';
import { Text } from '@/ui/Text';

interface BreakRow {
  key: string;
  startAt: number;
  endAt: number;
  isPaid: boolean;
}
interface AdjRow {
  key: string;
  kind: AdjustmentKind;
  label: string;
  amount: string;
}

let rowKey = 0;
const nextKey = () => `r${++rowKey}`;

/** Add or edit a finished shift: employer, times, breaks, tips and extras, notes. Shows a live earnings preview. */
export default function ShiftEditorScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string; employerId?: string }>();
  const { t } = useI18n();
  const today = useDayKey();
  const shiftId = params.id === 'new' ? null : Number(params.id);

  const loaded = useQuery(async (db) => {
    const employers = await listEmployers(db, { includeArchived: true });
    const shift = shiftId === null ? null : await getShiftDetail(db, shiftId);
    const holidays = await getEnabledHolidayDates(db);
    return { employers, shift, holidays };
  }, [shiftId]);

  if (!loaded.data) {
    return (
      <Screen variant="stack" title={t('common.loading')}>
        {null}
      </Screen>
    );
  }
  const initialDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  // The body initialises its state once from the loaded data; later reloads never overwrite edits.
  return (
    <ShiftEditorBody
      key={shiftId ?? 'new'}
      shiftId={shiftId}
      employers={loaded.data.employers}
      existing={loaded.data.shift}
      holidays={loaded.data.holidays}
      initialDate={initialDate}
      preferredEmployerId={Number(params.employerId)}
    />
  );
}

function ShiftEditorBody({
  shiftId,
  employers,
  existing,
  holidays,
  initialDate,
  preferredEmployerId,
}: {
  shiftId: number | null;
  employers: EmployerWithRule[];
  existing: ShiftDetail | null;
  holidays: ReadonlySet<string>;
  initialDate: string;
  preferredEmployerId: number;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, fmt, locale } = useI18n();
  const { run } = useActions();

  const defaultStart = localDateToMs(initialDate, 9 * 60);
  const [employerId, setEmployerId] = useState<number | null>(
    () => existing?.employerId ?? employers.find((e) => e.id === preferredEmployerId && !e.isArchived)?.id ?? employers.find((e) => !e.isArchived)?.id ?? employers[0]?.id ?? null,
  );
  const [startAt, setStartAt] = useState(() => existing?.startAt ?? defaultStart);
  const [endAt, setEndAt] = useState(() => (existing ? (existing.endAt ?? existing.startAt + MS_PER_HOUR) : defaultStart + 8 * MS_PER_HOUR));
  const [breaks, setBreaks] = useState<BreakRow[]>(() =>
    (existing?.breaks ?? []).map((b) => ({ key: nextKey(), startAt: b.startAt, endAt: b.endAt ?? existing?.endAt ?? b.startAt, isPaid: b.isPaid })),
  );
  const [adjustments, setAdjustments] = useState<AdjRow[]>(() =>
    (existing?.adjustments ?? []).map((a) => ({ key: nextKey(), kind: a.kind, label: a.label ?? '', amount: centsToPlainString(a.amountCents, fmt.decimalSeparator) })),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [useCurrentRule, setUseCurrentRule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const employer = employers.find((e) => e.id === employerId) ?? null;

  // The pay rule used for the preview: the shift's own rule while editing (unless re-pricing), else the employer's current rule.
  const previewRule = useQuery(
    async (db) => {
      if (!employer) return null;
      if (existing && existing.employerId === employer.id && !useCurrentRule) return loadPayRule(db, existing.payRuleId);
      return employer.rule;
    },
    [employer?.id, existing?.id, useCurrentRule],
  ).data;

  const parsedAdjustments = useMemo(() => adjustments.map((a) => ({ kind: a.kind, label: a.label, cents: parseDecimal(a.amount, 2, a.kind === 'extra') })), [adjustments]);
  const adjustmentsValid = parsedAdjustments.every((a) => a.cents !== null && a.cents !== 0);

  const calc = useMemo(() => {
    if (!previewRule || endAt <= startAt) return null;
    return calculateShift({
      startAt,
      endAt,
      breaks,
      rule: previewRule,
      holidays,
      adjustments: parsedAdjustments.filter((a) => a.cents !== null).map((a) => ({ kind: a.kind, amountCents: a.cents as number })),
    });
  }, [previewRule, startAt, endAt, breaks, holidays, parsedAdjustments]);

  const currency = previewRule?.currency ?? employer?.currency ?? 'EUR';
  const units = { h: t('common.unit.hour'), m: t('common.unit.minute') };
  const symbol = currencySymbol(currency, locale);

  if (employers.length === 0) {
    return (
      <Screen variant="stack" title={t('shift.titleNew')}>
        <EmptyState icon="briefcase" title={t('shift.noEmployers')} body={t('employers.empty.body')} action={<Button label={t('employers.add')} onPress={() => router.replace('/employers/new')} />} />
      </Screen>
    );
  }

  const issues = validateShiftTimes({ startAt, endAt, breaks });
  const validationText = !adjustmentsValid ? t('error.amount_invalid') : issues[0] ? t(`error.${issues[0].code}` as TKey) : null;

  const onSave = async () => {
    if (employerId === null) return;
    if (validationText) {
      setError(validationText);
      return;
    }
    setError(null);
    setSaving(true);
    const res = await run((db) =>
      saveShift(
        db,
        {
          id: shiftId ?? undefined,
          employerId,
          startAt,
          endAt,
          breaks: breaks.map((b) => ({ startAt: b.startAt, endAt: b.endAt, isPaid: b.isPaid })),
          adjustments: parsedAdjustments.map((a) => ({ kind: a.kind, label: a.label, amountCents: a.cents as number })),
          notes,
          useCurrentRule,
        },
        Date.now(),
      ),
    );
    setSaving(false);
    if (res.ok) router.back();
    else setError(errorMessage(res.error, t));
  };

  const onDelete = () =>
    Alert.alert(t('shift.delete.title'), t('shift.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const res = await run((db) => deleteShift(db, shiftId as number));
          if (res.ok) router.back();
        },
      },
    ]);

  const addBreak = () => {
    const mid = startAt + Math.max(0, endAt - startAt) / 2;
    const s = Math.round((mid - 15 * 60_000) / 60_000) * 60_000;
    setBreaks((b) => [...b, { key: nextKey(), startAt: s, endAt: s + 30 * 60_000, isPaid: false }]);
  };

  const sameDay = toLocalDateString(startAt) === toLocalDateString(endAt);

  return (
    <Screen
      variant="stack"
      keyboard
      title={shiftId === null ? t('shift.titleNew') : t('shift.titleEdit')}
      footer={
        <View style={styles.footer}>
          {error ? (
            <Text variant="label" color="negative">
              {error}
            </Text>
          ) : null}
          <Button label={t('common.save')} icon="check" onPress={onSave} loading={saving} fullWidth />
        </View>
      }>
      <Card>
        <View style={styles.stack}>
          <Text variant="label" color="textSecondary">
            {t('shift.employer')}
          </Text>
          <View style={styles.wrapRow}>
            {employers
              .filter((e) => !e.isArchived || e.id === employerId)
              .map((e) => (
                <Chip key={e.id} label={e.name} color={e.color} selected={e.id === employerId} onPress={() => setEmployerId(e.id)} />
              ))}
          </View>
          <DateTimeField
            label={t('shift.start')}
            value={startAt}
            onChange={(ms) => {
              const delta = endAt - startAt;
              setStartAt(ms);
              if (endAt <= ms) setEndAt(ms + Math.max(delta, MS_PER_HOUR));
            }}
          />
          <DateTimeField
            label={t('shift.end')}
            value={endAt}
            onChange={(ms) => {
              // A night shift: an end time earlier than the start on the same day means "the next day".
              const d = new Date(ms);
              const nextDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, d.getHours(), d.getMinutes(), 0, 0).getTime();
              setEndAt(ms <= startAt && nextDay - startAt < 24 * MS_PER_HOUR ? nextDay : ms);
            }}
          />
          {!sameDay && endAt > startAt ? (
            <Text variant="caption" color="textSecondary">
              {t('shift.crossesMidnight')} · {fmt.dateMedium(endAt)}
            </Text>
          ) : null}
        </View>
      </Card>

      <SectionTitle>{t('shift.breaks')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          {breaks.map((b) => (
            <View key={b.key} style={[styles.nested, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <DateTimeField timeOnly label={t('common.from')} value={b.startAt} onChange={(ms) => setBreaks((all) => all.map((x) => (x.key === b.key ? { ...x, startAt: ms } : x)))} />
              <DateTimeField timeOnly label={t('common.to')} value={b.endAt} onChange={(ms) => setBreaks((all) => all.map((x) => (x.key === b.key ? { ...x, endAt: ms } : x)))} />
              <View style={styles.breakFooter}>
                <Segmented
                  value={b.isPaid ? 'paid' : 'unpaid'}
                  onChange={(v) => setBreaks((all) => all.map((x) => (x.key === b.key ? { ...x, isPaid: v === 'paid' } : x)))}
                  options={[
                    { value: 'unpaid', label: t('shift.break.unpaid') },
                    { value: 'paid', label: t('shift.break.paid') },
                  ]}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} onPress={() => setBreaks((all) => all.filter((x) => x.key !== b.key))} hitSlop={10} style={styles.removeBreak}>
                  <Icon name="trash-2" size={18} color={colors.negative} />
                </Pressable>
              </View>
            </View>
          ))}
          <Button label={t('shift.addBreak')} icon="plus" variant="secondary" onPress={addBreak} />
        </View>
      </Card>

      <SectionTitle>{t('shift.tipsExtras')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          {adjustments.map((a, i) => (
            <View key={a.key} style={[styles.nested, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <Segmented
                value={a.kind}
                onChange={(kind) => setAdjustments((all) => all.map((x) => (x.key === a.key ? { ...x, kind } : x)))}
                options={[
                  { value: 'tip', label: t('home.tip') },
                  { value: 'extra', label: t('home.extra') },
                ]}
              />
              <TextField label={t('common.amount')} value={a.amount} onChangeText={(amount) => setAdjustments((all) => all.map((x) => (x.key === a.key ? { ...x, amount } : x)))} keyboardType="decimal-pad" prefix={symbol} error={parsedAdjustments[i]?.cents === null || parsedAdjustments[i]?.cents === 0 ? t('error.amount_invalid') : null} />
              {a.kind === 'extra' ? <TextField label={t('shift.extraLabel')} value={a.label} onChangeText={(label) => setAdjustments((all) => all.map((x) => (x.key === a.key ? { ...x, label } : x)))} /> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} onPress={() => setAdjustments((all) => all.filter((x) => x.key !== a.key))} hitSlop={10} style={styles.removeAdj}>
                <Icon name="trash-2" size={18} color={colors.negative} />
              </Pressable>
            </View>
          ))}
          <View style={styles.rowButtons}>
            <View style={styles.flex}>
              <Button label={t('shift.addTip')} icon="plus" variant="secondary" onPress={() => setAdjustments((all) => [...all, { key: nextKey(), kind: 'tip', label: '', amount: '' }])} fullWidth />
            </View>
            <View style={styles.flex}>
              <Button label={t('shift.addExtra')} icon="plus" variant="secondary" onPress={() => setAdjustments((all) => [...all, { key: nextKey(), kind: 'extra', label: '', amount: '' }])} fullWidth />
            </View>
          </View>
        </View>
      </Card>

      <SectionTitle>{t('shift.notes')}</SectionTitle>
      <TextField value={notes} onChangeText={setNotes} multiline placeholder={t('shift.notesPlaceholder')} accessibilityLabel={t('shift.notes')} />

      {existing ? (
        <Card>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('shift.useCurrentRule')}</Text>
              <Text variant="label" color="textSecondary">
                {t('shift.useCurrentRule.help')}
              </Text>
            </View>
            <Switch value={useCurrentRule} onValueChange={setUseCurrentRule} trackColor={{ false: colors.surfaceAlt, true: colors.accent }} thumbColor="#FFFFFF" accessibilityLabel={t('shift.useCurrentRule')} />
          </View>
        </Card>
      ) : null}

      <SectionTitle>{t('shift.summary')}</SectionTitle>
      <Card>
        {calc ? (
          <View style={styles.stack}>
            <SummaryRow label={t('shift.summary.worked')} value={formatDurationShort(calc.paidMs, units)} />
            {calc.roundedMs !== calc.paidMs ? <SummaryRow label={t('shift.summary.counted')} value={formatDurationShort(calc.roundedMs, units)} /> : null}
            <SummaryRow label={t('shift.summary.time')} value={fmt.money(calc.timeCents, currency)} />
            {calc.fixedBonusCents !== 0 ? <SummaryRow label={t('shift.summary.fixed')} value={fmt.money(calc.fixedBonusCents, currency, { signDisplay: 'always' })} /> : null}
            {calc.tipsCents !== 0 ? <SummaryRow label={t('shift.summary.tips')} value={fmt.money(calc.tipsCents, currency, { signDisplay: 'always' })} /> : null}
            {calc.extrasCents !== 0 ? <SummaryRow label={t('shift.summary.extras')} value={fmt.money(calc.extrasCents, currency, { signDisplay: 'always' })} /> : null}
            <Divider />
            <SummaryRow label={t('common.total')} value={fmt.money(calc.totalCents, currency)} strong />
          </View>
        ) : (
          <Text variant="body" color="textSecondary">
            {validationText ?? '—'}
          </Text>
        )}
      </Card>

      {existing ? <Button label={t('common.delete')} icon="trash-2" variant="danger" onPress={onDelete} /> : null}
    </Screen>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'text' : 'textSecondary'}>
        {label}
      </Text>
      <Text variant={strong ? 'heading' : 'bodyStrong'} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: spacing.lg },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nested: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  breakFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  removeBreak: { paddingBottom: 14 },
  removeAdj: { alignSelf: 'flex-end' },
  rowButtons: { flexDirection: 'row', gap: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footer: { gap: spacing.sm },
});
