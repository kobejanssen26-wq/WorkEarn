import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n, useTheme } from '@/state/hooks';
import { spacing } from '@/theme/tokens';

import { IconButton } from './Surface';
import { Text } from './Text';

export interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Large title for tab screens (default) or compact header with back button for pushed screens. */
  variant?: 'tab' | 'stack';
  right?: ReactNode;
  children: ReactNode;
  /** Pinned content below the scroll area (e.g. a primary button). */
  footer?: ReactNode;
  scroll?: boolean;
  /** Use keyboard-aware scrolling (forms). */
  keyboard?: boolean;
  onBack?: () => void;
}

export function Screen({ title, subtitle, variant = 'tab', right, children, footer, scroll = true, keyboard = false, onBack }: ScreenProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const header =
    variant === 'stack' ? (
      <View style={[styles.stackHeader, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon="arrow-left" label={t('common.back')} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
        <Text variant="heading" numberOfLines={1} style={styles.stackTitle}>
          {title}
        </Text>
        <View style={styles.headerRight}>{right}</View>
      </View>
    ) : (
      <View style={[styles.tabHeader, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.tabHeaderText}>
          {subtitle ? (
            <Text variant="label" color="textSecondary">
              {subtitle}
            </Text>
          ) : null}
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerRight}>{right}</View>
      </View>
    );

  const contentStyle = [styles.content, { paddingBottom: (footer ? spacing.lg : spacing.xxxl) + (variant === 'stack' && !footer ? insets.bottom : 0) }];
  const body = scroll ? (
    keyboard ? (
      <KeyboardAwareScrollView style={styles.flex} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {children}
      </KeyboardAwareScrollView>
    ) : (
      <ScrollView style={styles.flex} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    )
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {header}
      {body}
      {footer ? <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  tabHeaderText: { flex: 1, gap: 2 },
  stackHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  stackTitle: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
