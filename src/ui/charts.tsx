import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/state/hooks';

import { Text } from './Text';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface BarDatum {
  key: string;
  label: string;
  /** Longer text for the selection tooltip (defaults to `label`). */
  tooltip?: string;
  value: number;
  /** Emphasise this bar (e.g. the current period). */
  highlight?: boolean;
}

/** Round a maximum up to a "nice" axis value (1, 2, 2.5, 5 x 10^n). */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function Bar({ x, width, baseY, targetHeight, progress, color, opacity }: { x: number; width: number; baseY: number; targetHeight: number; progress: SharedValue<number>; color: string; opacity: number }) {
  const props = useAnimatedProps(() => {
    const h = targetHeight * progress.value;
    return { y: baseY - h, height: h };
  });
  return <AnimatedRect x={x} width={width} rx={Math.min(6, width / 2)} fill={color} opacity={opacity} animatedProps={props} />;
}

/** Simple, accessible bar chart. Values are in the caller's unit (e.g. cents); `format` renders axis and tooltip text. */
export function BarChart({ data, format, height = 190, selectedKey, onSelect }: { data: readonly BarDatum[]; format: (value: number) => string; height?: number; selectedKey?: string | null; onSelect?: (key: string) => void }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const signature = data.map((d) => d.value).join(',');

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
  }, [signature, progress]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const left = 46;
  const top = 22;
  const bottom = 26;
  const chartW = Math.max(0, width - left - 4);
  const chartH = height - top - bottom;
  const slot = data.length > 0 ? chartW / data.length : 0;
  const barW = Math.max(4, Math.min(34, slot * 0.62));
  const baseY = top + chartH;
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const selected = data.find((d) => d.key === selectedKey) ?? null;

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityRole="image" accessibilityLabel={data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((f) => {
            const y = baseY - chartH * f;
            return (
              <G key={f}>
                <Line x1={left} x2={width} y1={y} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray={f === 0 ? undefined : '3 4'} />
                <SvgText x={left - 8} y={y + 4} fontSize={10} fill={colors.textTertiary} textAnchor="end" fontFamily="Inter_500Medium">
                  {format(max * f)}
                </SvgText>
              </G>
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / max) * chartH;
            const x = left + slot * i + (slot - barW) / 2;
            const isSelected = selected?.key === d.key;
            const opacity = selected ? (isSelected ? 1 : 0.35) : d.highlight ? 1 : 0.6;
            return (
              <G key={d.key}>
                <Bar x={x} width={barW} baseY={baseY} targetHeight={Math.max(d.value > 0 ? 3 : 0, h)} progress={progress} color={colors.accent} opacity={opacity} />
                {(data.length - 1 - i) % labelEvery === 0 || isSelected ? (
                  <SvgText x={left + slot * i + slot / 2} y={height - 8} fontSize={10} fill={isSelected ? colors.text : colors.textTertiary} textAnchor="middle" fontFamily="Inter_500Medium">
                    {d.label}
                  </SvgText>
                ) : null}
                <Rect x={left + slot * i} y={top} width={slot} height={chartH + bottom} fill="transparent" onPress={() => onSelect?.(d.key)} />
              </G>
            );
          })}
        </Svg>
      ) : null}
      {selected && width > 0 ? (
        <View pointerEvents="none" style={[styles.tooltip, { backgroundColor: colors.raised, borderColor: colors.border }]}>
          <Text variant="caption" color="textSecondary">
            {selected.tooltip ?? selected.label}
          </Text>
          <Text variant="label" tabular>
            {format(selected.value)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Horizontal share bar: a coloured fill inside a track. `fraction` is 0..1. */
export function ShareBar({ fraction, color }: { fraction: number; color: string }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const target = Math.max(0.02, Math.min(1, fraction));
  useEffect(() => {
    progress.value = withTiming(target, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [target, progress]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, animated]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, alignItems: 'flex-end' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
