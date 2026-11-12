import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { estimateShift, rateAt } from '@/core/engine';
import { formatClock } from '@/core/time';
import type { PayRule } from '@/core/types';
import type { EmployerWithRule } from '@/db/employers';
import type { ShiftDetail } from '@/db/shifts';
import { useApp } from '@/state/AppProvider';
import { useI18n, useTheme } from '@/state/hooks';
import { radius, spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Pill } from '@/ui/Surface';
import { Text } from '@/ui/Text';

export interface ActiveView {
  shift: ShiftDetail;
  rule: PayRule;
  employer: EmployerWithRule | null;
}

/** Live totals of the running shift, recomputed from timestamps (never accumulated). */
export function useLiveCalc(active: ActiveView | null, holidays: ReadonlySet<string>, now: number) {
  return useMemo(() => {
    if (!active) return null;
    return estimateShift({
      startAt: active.shift.startAt,
      now: Math.max(now, active.shift.startAt),
      breaks: active.shift.breaks,
      rule: active.rule,
      holidays,
      adjustments: active.shift.adjustments,
    });
  }, [active, holidays, now]);
}

function PulseDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) })), -1);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.pulse, style]} />;
}

export function LiveHero({
  active,
  employer,
  holidays,
  now,
  onStart,
  onPause,
  onResume,
  onStop,
  onTogglePausePaid,
  startDisabled,
  busy,
}: {
  active: ActiveView | null;
  employer: EmployerWithRule | null;
  holidays: ReadonlySet<string>;
  now: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onTogglePausePaid: (paid: boolean) => void;
  startDisabled: boolean;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const { t, fmt } = useI18n();
  const { settings } = useApp();
  const [revealed, setRevealed] = useState(false);
  const calc = useLiveCalc(active, holidays, now);
  const openBreak = active?.shift.breaks.find((b) => b.endAt === null) ?? null;
  const paused = openBreak !== null;
  const rule = active?.rule ?? employer?.rule ?? null;
  const currency = rule?.currency ?? settings.currency;
  const masked = settings.hideAmounts && !revealed;
  const hideCents = !settings.showCents;
  const money = (cents: number) => (masked ? t('home.hiddenAmount') : fmt.money(cents, currency, { hideCents }));

  const snapshot = rule ? rateAt(rule, now, holidays) : null;
  const status = active ? (paused ? 'paused' : 'live') : 'ready';
  const bonusCents = calc ? calc.fixedBonusCents + calc.adjustmentsCents : 0;

  return (
    <View style={[styles.hero, { borderRadius: radius.xl }]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="heroGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.hero[0]} />
            <Stop offset="1" stopColor={colors.hero[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#heroGradient)" />
        <Circle cx="92%" cy="-6%" r="130" fill="rgba(255,255,255,0.09)" />
        <Circle cx="-8%" cy="112%" r="110" fill="rgba(255,255,255,0.07)" />
      </Svg>

      <View style={styles.heroBody}>
        <View style={styles.topRow}>
          <View style={styles.statusRow}>
            {status === 'live' ? <PulseDot /> : <View style={[styles.pulse, { opacity: status === 'paused' ? 1 : 0.5, backgroundColor: status === 'paused' ? '#FDE68A' : '#FFFFFF' }]} />}
            <Text variant="caption" color={colors.heroText} style={styles.upper}>
              {status === 'live' ? t('home.status.live') : status === 'paused' ? t('home.status.paused') : t('home.status.ready')}
            </Text>
            {employer ? (
              <Text variant="caption" color={colors.heroTextMuted} numberOfLines={1} style={styles.employerName}>
                · {employer.name}
              </Text>
            ) : null}
          </View>
          {settings.hideAmounts ? (
            <Pressable accessibilityRole="button" accessibilityLabel={revealed ? t('common.off') : t('common.on')} hitSlop={12} onPress={() => setRevealed((r) => !r)}>
              <Icon name={revealed ? 'eye' : 'eye-off'} size={20} color={colors.heroText} />
            </Pressable>
          ) : null}
        </View>

        <Text variant="label" color={colors.heroTextMuted} style={styles.caption}>
          {t('home.liveEarnings')}
        </Text>
        <Text variant="display" color={colors.heroText} tabular numberOfLines={1} adjustsFontSizeToFit accessibilityLiveRegion="none" accessibilityLabel={`${t('home.liveEarnings')}: ${money(calc?.timeCents ?? 0)}`}>
          {money(calc?.timeCents ?? 0)}
        </Text>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text variant="caption" color={colors.heroTextMuted}>
              {t('home.worked')}
            </Text>
            <Text variant="number" color={colors.heroText} tabular>
              {formatClock(calc?.paidMs ?? 0)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text variant="caption" color={colors.heroTextMuted}>
              {t('home.currentRate')}
            </Text>
            <Text variant="number" color={colors.heroText} tabular>
              {snapshot && rule ? `${fmt.rate(Math.round(snapshot.rateUnits), currency)}${t('common.perHour')}` : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.pills}>
          {snapshot?.modifiers.map((m) => (
            <Pill key={m} tone="hero" label={m.startsWith('custom:') ? m.slice(7) : t(`rate.${m}` as 'rate.saturday')} />
          ))}
          {active ? <Pill tone="hero" label={t('home.since', { time: fmt.time(active.shift.startAt) })} /> : null}
          {paused && openBreak ? <Pill tone="hero" label={t('home.pausedFor', { time: formatClock(Math.max(0, now - openBreak.startAt), false) })} /> : null}
        </View>

        {active && bonusCents !== 0 ? (
          <View style={styles.bonusRow}>
            <Text variant="label" color={colors.heroTextMuted}>
              {t('home.bonuses')}
            </Text>
            <Text variant="label" color={colors.heroText} tabular>
              {masked ? t('home.hiddenAmount') : fmt.money(bonusCents, currency, { signDisplay: 'always', hideCents })}
            </Text>
          </View>
        ) : null}
        {active && bonusCents !== 0 ? (
          <View style={styles.bonusRow}>
            <Text variant="label" color={colors.heroTextMuted}>
              {t('home.estimatedTotal')}
            </Text>
            <Text variant="bodyStrong" color={colors.heroText} tabular>
              {money(calc?.totalCents ?? 0)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {!active ? (
          <Button label={t('home.start')} icon="play" size="lg" variant="secondary" onPress={onStart} disabled={startDisabled} loading={busy} fullWidth />
        ) : (
          <>
            <View style={styles.flex}>
              <Button label={paused ? t('home.resume') : t('home.pause')} icon={paused ? 'play' : 'pause'} size="lg" variant="secondary" onPress={paused ? onResume : onPause} loading={busy} fullWidth />
            </View>
            <View style={styles.flex}>
              <Button label={t('home.stop')} icon="square" size="lg" variant="danger" onPress={onStop} disabled={busy} fullWidth />
            </View>
          </>
        )}
      </View>

      {paused && openBreak ? (
        <View style={styles.pauseType}>
          {([false, true] as const).map((paid) => {
            const selected = openBreak.isPaid === paid;
            return (
              <Pressable
                key={String(paid)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onTogglePausePaid(paid)}
                style={[styles.pauseChip, { backgroundColor: selected ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)' }]}>
                <Text variant="caption" color={colors.heroText}>
                  {paid ? t('home.pauseType.paid') : t('home.pauseType.unpaid')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** Today / this week cards including the running shift's live estimate. */
export function TotalsRow({ todayCents, todayMs, weekCents, weekMs, currency, masked, hideCents }: { todayCents: number; todayMs: number; weekCents: number; weekMs: number; currency: string; masked: boolean; hideCents: boolean }) {
  const { colors } = useTheme();
  const { t, fmt } = useI18n();
  const item = (title: string, cents: number, ms: number) => (
    <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="label" color="textSecondary">
        {title}
      </Text>
      <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit>
        {masked ? t('home.hiddenAmount') : fmt.money(cents, currency, { hideCents })}
      </Text>
      <Text variant="label" color="textSecondary" tabular>
        {formatDurationHM(ms, t)}
      </Text>
    </View>
  );
  return (
    <View style={styles.totalsRow}>
      {item(t('home.today'), todayCents, todayMs)}
      {item(t('home.thisWeek'), weekCents, weekMs)}
    </View>
  );
}

function formatDurationHM(ms: number, t: ReturnType<typeof useI18n>['t']): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}${t('common.unit.hour')} ${String(m).padStart(2, '0')}${t('common.unit.minute')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { overflow: 'hidden' },
  heroBody: { padding: spacing.xl, paddingBottom: spacing.md, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  pulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#86EFAC' },
  upper: { textTransform: 'uppercase', letterSpacing: 1 },
  employerName: { flexShrink: 1 },
  caption: { marginBottom: 2 },
  metrics: { flexDirection: 'row', gap: spacing.xxl, marginTop: spacing.lg },
  metric: { gap: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  bonusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  pauseType: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, marginTop: -spacing.sm },
  pauseChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  totalsRow: { flexDirection: 'row', gap: spacing.md },
  totalCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 4 },
});
