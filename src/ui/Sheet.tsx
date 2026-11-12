import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n, useTheme } from '@/state/hooks';
import { radius, spacing } from '@/theme/tokens';

import { Text } from './Text';

/** Bottom sheet. Keep text inputs out of sheets; use a screen for forms. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { backgroundColor: colors.raised, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {title ? (
            <Text variant="heading" style={styles.title}>
              {title}
            </Text>
          ) : null}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  title: { marginBottom: spacing.md },
  body: { gap: spacing.md, paddingBottom: spacing.sm },
});
