import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { SUPPORTED_CURRENCIES } from '@/core/payRule';
import type { Language, TimeFormat } from '@/db/settings';
import { LANGUAGES, LANGUAGE_NAMES } from '@/i18n';
import { useApp } from '@/state/AppProvider';
import { useI18n } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Segmented, SwitchRow } from '@/ui/Fields';
import { Screen } from '@/ui/Screen';
import { Card, Chip, Row, SectionTitle } from '@/ui/Surface';
import { Text } from '@/ui/Text';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { settings, updateSetting, resetAll } = useApp();

  const onDeleteAll = () =>
    Alert.alert(t('settings.deleteAll.title'), t('settings.deleteAll.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAll.confirm'),
        style: 'destructive',
        onPress: async () => {
          await resetAll();
          router.replace('/');
        },
      },
    ]);

  return (
    <Screen variant="stack" title={t('settings.title')}>
      <SectionTitle>{t('settings.section.appearance')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          <Segmented
            label={t('settings.theme')}
            value={settings.theme}
            onChange={(v) => void updateSetting('theme', v)}
            options={[
              { value: 'system', label: t('settings.theme.system') },
              { value: 'light', label: t('settings.theme.light') },
              { value: 'dark', label: t('settings.theme.dark') },
            ]}
          />
          <Segmented label={t('settings.language')} value={settings.language} onChange={(v: Language) => void updateSetting('language', v)} options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))} />
        </View>
      </Card>

      <SectionTitle>{t('settings.section.work')}</SectionTitle>
      <Card padded={false}>
        <View style={styles.rows}>
          <Row icon="briefcase" title={t('settings.employers')} subtitle={t('settings.employers.help')} onPress={() => router.push('/employers')} />
          <Row icon="flag" title={t('settings.holidays')} subtitle={t('settings.holidays.help')} onPress={() => router.push('/settings/holidays')} last />
        </View>
      </Card>
      <Card>
        <View style={styles.stack}>
          <Segmented
            label={t('settings.weekStart')}
            value={settings.weekStart}
            onChange={(v) => void updateSetting('weekStart', v)}
            options={[
              { value: 0, label: t('settings.weekStart.monday') },
              { value: 6, label: t('settings.weekStart.sunday') },
            ]}
          />
          <Segmented
            label={t('settings.timeFormat')}
            value={settings.timeFormat}
            onChange={(v: TimeFormat) => void updateSetting('timeFormat', v)}
            options={[
              { value: 'auto', label: t('settings.timeFormat.auto') },
              { value: '24h', label: t('settings.timeFormat.24h') },
              { value: '12h', label: t('settings.timeFormat.12h') },
            ]}
          />
          <View style={styles.stackSmall}>
            <Text variant="label" color="textSecondary">
              {t('settings.currency')}
            </Text>
            <View style={styles.wrapRow}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <Chip key={c} label={c} selected={settings.currency === c} onPress={() => void updateSetting('currency', c)} />
              ))}
            </View>
            <Text variant="caption" color="textSecondary">
              {t('settings.currency.help')}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle>{t('settings.section.earnings')}</SectionTitle>
      <Card>
        <SwitchRow title={t('settings.showCents')} value={settings.showCents} onValueChange={(v) => void updateSetting('showCents', v)} />
        <SwitchRow title={t('settings.hideAmounts')} subtitle={t('settings.hideAmounts.help')} value={settings.hideAmounts} onValueChange={(v) => void updateSetting('hideAmounts', v)} />
        <SwitchRow title={t('settings.pausePaid')} subtitle={t('settings.pausePaid.help')} value={settings.pausePaidByDefault} onValueChange={(v) => void updateSetting('pausePaidByDefault', v)} />
        <SwitchRow title={t('settings.keepAwake')} subtitle={t('settings.keepAwake.help')} value={settings.keepAwake} onValueChange={(v) => void updateSetting('keepAwake', v)} last />
      </Card>

      <SectionTitle>{t('settings.section.data')}</SectionTitle>
      <Card padded={false}>
        <View style={styles.rows}>
          <Row icon="download" title={t('settings.export')} subtitle={t('settings.export.help')} onPress={() => router.push('/settings/export')} />
          <Row icon="trash-2" tone="danger" title={t('settings.deleteAll')} subtitle={t('settings.deleteAll.help')} onPress={onDeleteAll} last />
        </View>
      </Card>

      <SectionTitle>{t('settings.section.about')}</SectionTitle>
      <Card padded={false}>
        <View style={styles.rows}>
          <Row icon="shield" title={t('settings.privacy')} subtitle={t('settings.privacy.help')} onPress={() => router.push('/settings/privacy')} />
          <Row icon="info" title={t('settings.about')} onPress={() => router.push('/settings/about')} last />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  stackSmall: { gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rows: { paddingHorizontal: spacing.lg },
});
