/* Mocks for native-only modules so screens can render in Jest. The database is NOT mocked: tests plug in real SQLite. */
import type { ReactNode } from 'react';

jest.mock('@/db/expoDriver', () => ({
  openAppDatabase: async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockState: state } = require('../helpers/mockState');
    return state.db;
  },
}));

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockState: state } = require('../helpers/mockState');
  return {
    useRouter: () => state.router,
    useLocalSearchParams: () => state.params,
    Link: ({ children }: { children: ReactNode }) => children,
  };
});

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native');
  const sharedValue = (initial: unknown) => ({ value: initial, get: () => initial, set: () => undefined });
  const identity = <T,>(v: T) => v;
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: identity },
    useSharedValue: sharedValue,
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    withTiming: identity,
    withRepeat: identity,
    withSequence: (...v: unknown[]) => v[v.length - 1],
    Easing: { out: identity, inOut: identity, cubic: identity, quad: identity },
  };
});

jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView, Text: RNText } = require('react-native');
  return { __esModule: true, default: RNView, Svg: RNView, Circle: RNView, Defs: RNView, LinearGradient: RNView, Rect: RNView, Stop: RNView, G: RNView, Line: RNView, Text: RNText };
});

jest.mock('react-native-keyboard-controller', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ScrollView: RNScrollView } = require('react-native');
  return { KeyboardAwareScrollView: RNScrollView, KeyboardProvider: ({ children }: { children: ReactNode }) => children };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() } }));
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(async () => undefined), deactivateKeepAwake: jest.fn(async () => undefined) }));
jest.mock('@expo/vector-icons/Feather', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement } = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: RNText } = require('react-native');
  const Icon = ({ name }: { name: string }) => createElement(RNText, null, `icon:${name}`);
  Icon.font = {};
  return { __esModule: true, default: Icon };
});

jest.mock('@/services/exportCsv', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockState: state } = require('../helpers/mockState');
  return {
    writeCsvToCache: jest.fn(async (csv: string, name: string) => {
      state.lastCsv = csv;
      return `file:///cache/${name}`;
    }),
    shareCsv: jest.fn(async () => 'shared'),
  };
});
