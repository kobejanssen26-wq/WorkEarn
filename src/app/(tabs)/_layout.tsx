import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n, useTheme } from '@/state/hooks';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/Icon';

const TABS: { name: string; title: 'tabs.home' | 'tabs.calendar' | 'tabs.history' | 'tabs.statistics'; icon: IconName }[] = [
  { name: 'index', title: 'tabs.home', icon: 'home' },
  { name: 'calendar', title: 'tabs.calendar', icon: 'calendar' },
  { name: 'history', title: 'tabs.history', icon: 'clock' },
  { name: 'statistics', title: 'tabs.statistics', icon: 'bar-chart-2' },
];

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 2 },
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, height: 68 + insets.bottom, paddingBottom: insets.bottom + 8, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: t(tab.title), tabBarIcon: ({ color }) => <Icon name={tab.icon} size={22} color={typeof color === 'string' ? color : colors.accent} />, tabBarAccessibilityLabel: t(tab.title) }}
        />
      ))}
    </Tabs>
  );
}
