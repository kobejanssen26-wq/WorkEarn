import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { useTheme } from '@/state/hooks';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={color ?? colors.text} />;
}

/** Font to preload so icons never flash empty. */
export const iconFont = Feather.font;
