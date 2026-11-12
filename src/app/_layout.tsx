import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Appearance, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/state/AppProvider';
import { useTheme } from '@/state/hooks';
import { iconFont } from '@/ui/Icon';

void SplashScreen.preventAutoHideAsync();

// Only the four weights the design uses are bundled (importing the package barrel would ship all 18 font files).
const FONTS = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ ...FONTS, ...iconFont });
  const [appReady, setAppReady] = useState(false);
  const onReady = useCallback(() => setAppReady(true), []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && appReady) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, appReady]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AppProvider onReady={onReady} renderError={(error, retry) => <BootError error={error} retry={retry} />}>
          <Shell />
        </AppProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

/** Applies the theme preference to the system UI and renders the navigation stack. */
function Shell() {
  const { settings } = useApp();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    Appearance.setColorScheme(settings.theme === 'system' ? 'unspecified' : settings.theme);
  }, [settings.theme]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </View>
  );
}

/** Shown if the local database cannot be opened (rare). Plain styling: the theme is not available yet. */
function BootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <View style={styles.error}>
      <RNText style={styles.errorTitle}>WorkEarn</RNText>
      <RNText style={styles.errorBody}>The local database could not be opened. Your data is untouched.</RNText>
      <RNText style={styles.errorDetail}>{error instanceof Error ? error.message : String(error)}</RNText>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.errorButton}>
        <RNText style={styles.errorButtonText}>Try again</RNText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: '#0F1113' },
  errorTitle: { color: '#F1F5F3', fontSize: 28, fontWeight: '700' },
  errorBody: { color: '#A2AFA8', fontSize: 16, textAlign: 'center' },
  errorDetail: { color: '#74817A', fontSize: 12, textAlign: 'center' },
  errorButton: { backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  errorButtonText: { color: '#04130C', fontSize: 16, fontWeight: '600' },
});
