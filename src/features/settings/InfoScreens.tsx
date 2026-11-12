import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import type { TKey } from '@/i18n';
import { useI18n } from '@/state/hooks';
import { spacing } from '@/theme/tokens';
import { Screen } from '@/ui/Screen';
import { Card, Row } from '@/ui/Surface';
import { Text } from '@/ui/Text';

const PRIVACY_SECTIONS: { title: TKey; body: TKey }[] = [
  { title: 'privacy.stored.title', body: 'privacy.stored.body' },
  { title: 'privacy.network.title', body: 'privacy.network.body' },
  { title: 'privacy.analytics.title', body: 'privacy.analytics.body' },
  { title: 'privacy.export.title', body: 'privacy.export.body' },
  { title: 'privacy.control.title', body: 'privacy.control.body' },
];

export function PrivacyScreen() {
  const { t } = useI18n();
  return (
    <Screen variant="stack" title={t('privacy.title')}>
      <Text variant="body" color="textSecondary">
        {t('privacy.intro')}
      </Text>
      {PRIVACY_SECTIONS.map((s) => (
        <Card key={s.title}>
          <View style={styles.stack}>
            <Text variant="heading">{t(s.title)}</Text>
            <Text variant="body" color="textSecondary">
              {t(s.body)}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export function AboutScreen() {
  const { t } = useI18n();
  // The app config (app.json) is embedded in the build, so this is the version that was actually shipped.
  const config = Constants.expoConfig;
  return (
    <Screen variant="stack" title={t('about.title')}>
      <Card>
        <View style={styles.stack}>
          <Text variant="title">{t('app.name')}</Text>
          <Text variant="body" color="textSecondary">
            {t('app.tagline')}
          </Text>
        </View>
      </Card>
      <Card padded={false}>
        <View style={styles.rows}>
          <Row title={t('about.version')} right={<Text variant="bodyStrong">{config?.version ?? '—'}</Text>} />
          <Row title={t('about.build')} right={<Text variant="bodyStrong">{String(config?.android?.versionCode ?? '—')}</Text>} />
          <Row title={t('about.package')} right={<Text variant="label">{config?.android?.package ?? '—'}</Text>} last />
        </View>
      </Card>
      <Text variant="label" color="textSecondary">
        {t('about.calculations')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  rows: { paddingHorizontal: spacing.lg },
});
