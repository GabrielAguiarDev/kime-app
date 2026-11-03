import { AppleLogo } from 'phosphor-react-native/src/icons/AppleLogo';
import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { Barbell } from 'phosphor-react-native/src/icons/Barbell';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { Checks } from 'phosphor-react-native/src/icons/Checks';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { CloudSlash } from 'phosphor-react-native/src/icons/CloudSlash';
import { DeviceMobile } from 'phosphor-react-native/src/icons/DeviceMobile';
import { Drop } from 'phosphor-react-native/src/icons/Drop';
import { House } from 'phosphor-react-native/src/icons/House';
import { LinkBreak } from 'phosphor-react-native/src/icons/LinkBreak';
import { ListChecks } from 'phosphor-react-native/src/icons/ListChecks';
import { Medal } from 'phosphor-react-native/src/icons/Medal';
import { Moon } from 'phosphor-react-native/src/icons/Moon';
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork';
import { Sun } from 'phosphor-react-native/src/icons/Sun';
import { Trophy } from 'phosphor-react-native/src/icons/Trophy';
import { User } from 'phosphor-react-native/src/icons/User';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { XCircle } from 'phosphor-react-native/src/icons/XCircle';

import { useAppTheme, type ColorToken } from '@theme';

/**
 * Phosphor icons used by the app (DESIGN-SYSTEM.md, section 5). Each icon is imported from its
 * own file so the bundle doesn't carry the whole library. Add new icons here.
 */
const ICONS = {
  apple: AppleLogo,
  barbell: Barbell,
  calendar: CalendarBlank,
  check: CheckCircle,
  checks: Checks,
  clock: Clock,
  confirmations: ListChecks,
  device: DeviceMobile,
  drop: Drop,
  home: House,
  light: Sun,
  linkBroken: LinkBreak,
  dark: Moon,
  offline: CloudSlash,
  professor: Medal,
  refresh: ArrowClockwise,
  rejected: XCircle,
  share: ShareNetwork,
  trophy: Trophy,
  user: User,
  users: Users,
  warning: Warning,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  /** Default: tokens.size.icon (24). Use size.iconInline (20) inline, size.iconEmpty (48) in empty states. */
  size?: number;
  color?: ColorToken;
  /** Active state uses the `fill` weight; normal state uses `bold`. */
  active?: boolean;
}

export function Icon({ name, size, color = 'text', active = false }: IconProps) {
  const theme = useAppTheme();
  const Component = ICONS[name];
  return (
    <Component
      size={size ?? theme.size.icon}
      color={theme.colors[color]}
      weight={active ? 'fill' : 'bold'}
    />
  );
}
