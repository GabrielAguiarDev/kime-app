import Ionicons from '@expo/vector-icons/Ionicons';

import { useAppTheme, type ColorToken } from '@theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorToken;
}

export function Icon({ name, size = 24, color = 'text' }: IconProps) {
  const { colors } = useAppTheme();
  return <Ionicons name={name} size={size} color={colors[color]} />;
}
