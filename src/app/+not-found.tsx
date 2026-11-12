import { Link } from 'expo-router';
import { View } from 'react-native';

import { useI18n } from '@/state/hooks';
import { Text } from '@/ui/Text';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      <Text variant="heading">{t('error.not_found')}</Text>
      <Link href="/" accessibilityRole="link">
        <Text variant="bodyStrong" color="accent">
          {t('tabs.home')}
        </Text>
      </Link>
    </View>
  );
}
