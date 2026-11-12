import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { parseDecimal } from '@/core/money';
import { setActiveShiftStartLocal } from '@/features/home/startTime';
import { useApp } from '@/state/AppProvider';
import { useActions, useDayKey, useI18n, useIs24Hour, useMinuteNow, useNow, useTheme } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { addAdjustment, discardActiveShift, pauseShift, resumeShift, setActiveShiftStart, setOpenBreakPaid, startShift, stopShift } from '@/services/shifts';
import { Button } from '@/ui/Button';
import { Field, Segmented, TextField } from '@/ui/Fields';
import { Screen } from '@/ui/Screen';
import { Card, Chip, EmptyState, IconButton, Row } from '@/ui/Surface';
import { Text } from '@/ui/Text';

import { LiveHero, TotalsRow, useLiveCalc } from './LiveHero';
import { StopSheet } from './StopSheet';
import { useHomeData } from './useHomeData';

const LONG_SHIFT_MS = 16 * 3_600_000;

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, fmt } = useI18n();
  const { settings, updateSetting } = useApp();
  const { run } = useActions();
  const is24Hour = useIs24Hour();
  const dayKey = useDayKey();
  const { data, loading, error, reload } = useHomeData(dayKey);
  const [busy, setBusy] = useState(false);
  const [stopAt, setStopAt] = useState<number | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipKind, setTipKind] = useState<'tip' | 'extra'>('tip');
  const [tipText, setTipText] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(settings.lastEmployerId);

  const active = data?.active ?? null;
  const employers = data?.employers ?? [];
  const holidays = data?.holidays ?? new Set<string>();
  const effectiveId = active ? active.shift.employerId : employers.some((e) => e.id === selectedId) ? selectedId : (employers[0]?.id ?? null);
  const selectedEmployer = employers.find((e) => e.id === effectiveId) ?? active?.employer ?? null;

  // The only thing that ticks every second is the clock; everything shown is recomputed from timestamps.
  const secondNow = useNow(active !== null);
  const minuteNow = useMinuteNow();
  const now = active ? secondNow : minuteNow;
  const calc = useLiveCalc(active, holidays, now);

  useEffect(() => {
    if (!active || !settings.keepAwake) return;
    void activateKeepAwakeAsync('workearn-live');
    return () => {
      void deactivateKeepAwake('workearn-live');
    };
  }, [active, settings.keepAwake]);

  const guarded = async (task: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const onStart = () =>
    guarded(async () => {
      if (!selectedEmployer) return;
      const res = await run((db) => startShift(db, selectedEmployer.id, Date.now()));
      if (res.ok) void updateSetting('lastEmployerId', selectedEmployer.id);
    });
  const onPause = () => guarded(() => run((db) => pauseShift(db, active!.shift.id, Date.now(), settings.pausePaidByDefault)));
  const onResume = () => guarded(() => run((db) => resumeShift(db, active!.shift.id, Date.now())));
  const onConfirmStop = () =>
    guarded(async () => {
      const res = await run((db) => stopShift(db, active!.shift.id, stopAt ?? Date.now()));
      if (res.ok) setStopAt(null);
    });

  const onAddTip = () =>
    guarded(async () => {
      const cents = parseDecimal(tipText, 2);
      if (cents === null || cents === 0 || !active) {
        Alert.alert(t('common.error.title'), t('error.amount_invalid'));
        return;
      }
      const res = await run((db) => addAdjustment(db, active.shift.id, { kind: tipKind, amountCents: cents }, Date.now()));
      if (res.ok) {
        setTipText('');
        setTipOpen(false);
      }
    });

  const onChangeStart = () => {
    if (!active) return;
    const current = active.shift.startAt;
    DateTimePickerAndroid.open({
      value: new Date(current),
      mode: 'time',
      is24Hour,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        const nowMs = Date.now();
        const candidate = setActiveShiftStartLocal(current, date.getHours(), date.getMinutes(), nowMs);
        void run((db) => setActiveShiftStart(db, active.shift.id, candidate, nowMs));
      },
    });
  };

  const onDiscard = () =>
    Alert.alert(t('home.cancelShift.title'), t('home.cancelShift.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void run((db) => discardActiveShift(db, active!.shift.id)) },
    ]);

  const hour = new Date(minuteNow).getHours();
  const greeting = hour < 12 ? t('home.greeting.morning') : hour < 18 ? t('home.greeting.afternoon') : t('home.greeting.evening');
  const currency = active?.rule.currency ?? selectedEmployer?.currency ?? settings.currency;
  const masked = settings.hideAmounts;
  const hideCents = !settings.showCents;

  const sumFor = (from: string, to: string) =>
    (data?.weekShifts ?? []).filter((s) => s.currency === currency && s.localDate >= from && s.localDate <= to).reduce((a, s) => ({ cents: a.cents + (s.totalCents ?? 0), ms: a.ms + (s.roundedMs ?? 0) }), { cents: 0, ms: 0 });
  const todaySum = sumFor(dayKey, dayKey);
  const weekSum = sumFor(data?.weekStart ?? dayKey, data?.weekEnd ?? dayKey);
  const activeToday = active && active.shift.localDate === dayKey && active.rule.currency === currency ? calc : null;
  const inWeek = active && data ? active.shift.localDate >= data.weekStart && active.shift.localDate <= data.weekEnd && active.rule.currency === currency : false;
  const activeWeek = inWeek ? calc : null;

  const right = (
    <>
      <IconButton icon="briefcase" label={t('employers.title')} onPress={() => router.push('/employers')} />
      <IconButton icon="settings" label={t('settings.title')} onPress={() => router.push('/settings')} />
    </>
  );

  if (error && !data) {
    return (
      <Screen title={t('app.name')} subtitle={greeting} right={right}>
        <EmptyState icon="alert-triangle" title={t('common.error.title')} body={t('common.errorLoading')} action={<Button label={t('common.back')} onPress={reload} />} />
      </Screen>
    );
  }

  return (
    <Screen title={t('app.name')} subtitle={`${greeting} · ${fmt.dateMedium(minuteNow)}`} right={right}>
      {loading && !data ? null : employers.length === 0 && !active ? (
        <Card>
          <EmptyState
            icon="briefcase"
            title={t('home.noEmployers.title')}
            body={t('home.noEmployers.body')}
            action={<Button label={t('home.addEmployer')} icon="plus" onPress={() => router.push('/employers/new')} />}
          />
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel={t('home.selectEmployer')}>
            {(active && !employers.some((e) => e.id === active.shift.employerId) && active.employer ? [active.employer, ...employers] : employers).map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                color={e.color}
                selected={e.id === effectiveId}
                onPress={() => {
                  if (!active) setSelectedId(e.id);
                }}
              />
            ))}
            <Chip label={t('home.manageEmployers')} icon="settings" onPress={() => router.push('/employers')} />
          </ScrollView>

          <LiveHero
            active={active}
            employer={selectedEmployer}
            holidays={holidays}
            now={now}
            busy={busy}
            startDisabled={!selectedEmployer}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onStop={() => setStopAt(Date.now())}
            onTogglePausePaid={(paid) => void run((db) => setOpenBreakPaid(db, active!.shift.id, paid))}
          />

          {active ? (
            <Text variant="caption" color="textSecondary">
              {t('home.estimateNote')}
            </Text>
          ) : null}

          {active && now - active.shift.startAt > LONG_SHIFT_MS ? (
            <View style={[styles.warning, { backgroundColor: colors.warningSoft }]}>
              <Text variant="label" color="warning">
                {t('home.longShift')}
              </Text>
            </View>
          ) : null}

          {active ? (
            <Card padded={false} style={styles.actionsCard}>
              <View style={styles.actionsInner}>
                <Row icon="plus-circle" title={t('home.addTip')} onPress={() => setTipOpen((o) => !o)} />
                {tipOpen ? (
                  <View style={styles.tipPanel}>
                    <Segmented
                      value={tipKind}
                      onChange={setTipKind}
                      options={[
                        { value: 'tip', label: t('home.tip') },
                        { value: 'extra', label: t('home.extra') },
                      ]}
                    />
                    <TextField label={t('common.amount')} value={tipText} onChangeText={setTipText} keyboardType="decimal-pad" placeholder={t('home.amountPlaceholder')} prefix={fmt.money(0, currency).replace(/[\d.,\s]/g, '')} />
                    <Field>
                      <Button label={t('common.add')} icon="check" onPress={onAddTip} loading={busy} />
                    </Field>
                  </View>
                ) : null}
                <Row icon="clock" title={t('home.editStart')} onPress={onChangeStart} />
                <Row icon="trash-2" title={t('home.cancelShift')} tone="danger" onPress={onDiscard} last />
              </View>
            </Card>
          ) : null}

          <TotalsRow
            currency={currency}
            masked={masked}
            hideCents={hideCents}
            todayCents={todaySum.cents + (activeToday?.totalCents ?? 0)}
            todayMs={todaySum.ms + (activeToday?.roundedMs ?? 0)}
            weekCents={weekSum.cents + (activeWeek?.totalCents ?? 0)}
            weekMs={weekSum.ms + (activeWeek?.roundedMs ?? 0)}
          />
        </>
      )}

      <StopSheet visible={stopAt !== null} stopAt={stopAt ?? now} active={active} holidays={holidays} hideCents={hideCents} busy={busy} onConfirm={onConfirmStop} onCancel={() => setStopAt(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingRight: spacing.xl },
  warning: { borderRadius: 14, padding: spacing.md },
  actionsCard: { overflow: 'hidden' },
  actionsInner: { paddingHorizontal: spacing.lg },
  tipPanel: { gap: spacing.md, paddingBottom: spacing.lg },
});
