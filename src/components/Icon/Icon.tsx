import { AppleLogo } from 'phosphor-react-native/src/icons/AppleLogo';
import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { ArrowDown } from 'phosphor-react-native/src/icons/ArrowDown';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { ArrowsDownUp } from 'phosphor-react-native/src/icons/ArrowsDownUp';
import { Barbell } from 'phosphor-react-native/src/icons/Barbell';
import { Bug } from 'phosphor-react-native/src/icons/Bug';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CaretDownIcon as CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { ChartBar } from 'phosphor-react-native/src/icons/ChartBar';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { CircleIcon as Circle } from 'phosphor-react-native/src/icons/Circle';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { Checks } from 'phosphor-react-native/src/icons/Checks';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { Copy } from 'phosphor-react-native/src/icons/Copy';
import { Crown } from 'phosphor-react-native/src/icons/Crown';
import { CloudSlash } from 'phosphor-react-native/src/icons/CloudSlash';
import { DeviceMobile } from 'phosphor-react-native/src/icons/DeviceMobile';
import { DeviceRotate } from 'phosphor-react-native/src/icons/DeviceRotate';
import { DotsSixVertical } from 'phosphor-react-native/src/icons/DotsSixVertical';
import { Drop } from 'phosphor-react-native/src/icons/Drop';
import { Fire } from 'phosphor-react-native/src/icons/Fire';
import { ForkKnife } from 'phosphor-react-native/src/icons/ForkKnife';
import { GearSix } from 'phosphor-react-native/src/icons/GearSix';
import { GraduationCap } from 'phosphor-react-native/src/icons/GraduationCap';
import { House } from 'phosphor-react-native/src/icons/House';
import { Image } from 'phosphor-react-native/src/icons/Image';
import { LinkBreak } from 'phosphor-react-native/src/icons/LinkBreak';
import { ListChecks } from 'phosphor-react-native/src/icons/ListChecks';
import { EnvelopeSimple } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { Lock } from 'phosphor-react-native/src/icons/Lock';
import { Medal } from 'phosphor-react-native/src/icons/Medal';
import { Minus } from 'phosphor-react-native/src/icons/Minus';
import { Moon } from 'phosphor-react-native/src/icons/Moon';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Prohibit } from 'phosphor-react-native/src/icons/Prohibit';
import { PauseIcon as Pause } from 'phosphor-react-native/src/icons/Pause';
import { PlayIcon as Play } from 'phosphor-react-native/src/icons/Play';
import { SkipBackIcon as SkipBack } from 'phosphor-react-native/src/icons/SkipBack';
import { SkipForwardIcon as SkipForward } from 'phosphor-react-native/src/icons/SkipForward';
import { TimerIcon as Timer } from 'phosphor-react-native/src/icons/Timer';
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork';
import { Snowflake } from 'phosphor-react-native/src/icons/Snowflake';
import { Sun } from 'phosphor-react-native/src/icons/Sun';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { Trophy } from 'phosphor-react-native/src/icons/Trophy';
import { User } from 'phosphor-react-native/src/icons/User';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { X } from 'phosphor-react-native/src/icons/X';
import { XCircle } from 'phosphor-react-native/src/icons/XCircle';

import { useAppTheme, type ColorToken } from '@theme';

/**
 * Phosphor icons used by the app (DESIGN-SYSTEM.md, section 5). Each icon is imported from its
 * own file so the bundle doesn't carry the whole library. Add new icons here.
 */
const ICONS = {
  arrowDown: ArrowDown,
  arrowUp: ArrowUp,
  reorder: ArrowsDownUp,
  dragHandle: DotsSixVertical,
  chevronRight: CaretRight,
  chevronLeft: CaretLeft,
  chevronDown: CaretDown,
  copy: Copy,
  diet: ForkKnife,
  chart: ChartBar,
  done: Check,
  edit: PencilSimple,
  flame: Fire,
  pause: Pause,
  play: Play,
  skipBack: SkipBack,
  skipForward: SkipForward,
  timer: Timer,
  freeze: Snowflake,
  missed: X,
  open: Circle,
  locked: Lock,
  plus: Plus,
  minus: Minus,
  deactivate: Prohibit,
  trash: Trash,
  apple: AppleLogo,
  back: ArrowLeft,
  barbell: Barbell,
  bug: Bug,
  belt: GraduationCap,
  camera: Camera,
  image: Image,
  calendar: CalendarBlank,
  check: CheckCircle,
  checks: Checks,
  clock: Clock,
  confirmations: ListChecks,
  device: DeviceMobile,
  rotate: DeviceRotate,
  drop: Drop,
  home: House,
  light: Sun,
  mail: EnvelopeSimple,
  medal: Medal,
  linkBroken: LinkBreak,
  dark: Moon,
  offline: CloudSlash,
  owner: Crown,
  professor: Medal,
  refresh: ArrowClockwise,
  rejected: XCircle,
  settings: GearSix,
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
