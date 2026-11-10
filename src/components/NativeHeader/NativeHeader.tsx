import { useMemo, type ReactNode } from 'react';
import { Platform, Pressable } from 'react-native';
import type { NativeStackNavigationOptions } from 'expo-router';

import { useAppTheme } from '@theme';

import { Icon, type IconName } from '../Icon/Icon';

/**
 * Native Stack header shared by every screen that has one (tabs and inner
 * screens), WhatsApp-like:
 *  - iOS: at rest NO bar — transparent, no blur (headerLargeStyle transparent
 *    → the scroll-edge appearance is fully transparent), large title
 *    (Barlow Condensed) on the left under the safe area. On scroll the large
 *    title moves up with the content; only once it is gone the compact bar
 *    appears: translucent dark-material blur (standard appearance only) with
 *    the small centered title (Inter SemiBold 17). The transition is the
 *    system's, driven by the scroll (authorized exception to "no animations").
 *    Standard iOS height: no custom header height, padding or margin.
 *  - Android (for now): standard compact header, title on the left, `bg` background.
 * Scroll views under it use contentInsetAdjustmentBehavior="automatic"
 * (see Screen with `nativeHeader`).
 */
export function useNativeHeaderOptions(): NativeStackNavigationOptions {
  const { colors, textVariants } = useAppTheme();
  return useMemo<NativeStackNavigationOptions>(() => {
    const titleStyle = {
      fontFamily: textVariants.navTitle.fontFamily,
      fontSize: textVariants.navTitle.fontSize,
      color: colors.text,
    };
    if (Platform.OS !== 'ios') {
      return {
        headerShown: true,
        orientation: 'portrait',
        headerTitleAlign: 'left',
        headerTitleStyle: titleStyle,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      };
    }
    return {
      headerShown: true,
      orientation: 'portrait',
      headerLargeTitleEnabled: true,
      headerTransparent: true,
      // Blur only on the compact (standard) appearance; the large-title area stays clear.
      headerBlurEffect: 'systemChromeMaterialDark',
      // iOS 26 adds its own top scroll-edge effect under the bar; with the blur above they
      // overlap (react-native-screens warns). Keep only the blur.
      scrollEdgeEffects: { top: 'hidden' },
      headerLargeStyle: { backgroundColor: 'transparent' },
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      headerUserInterfaceStyle: 'dark',
      headerTitleAlign: 'center',
      headerTitleStyle: titleStyle,
      headerLargeTitleStyle: {
        fontFamily: textVariants.navLargeTitle.fontFamily,
        fontSize: textVariants.navLargeTitle.fontSize,
        color: colors.text,
      },
      headerTintColor: colors.text,
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: colors.bg },
    };
  }, [colors, textVariants]);
}

interface HeaderButtonProps {
  icon?: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** Custom content instead of an icon (e.g. the academy logo on Início). */
  children?: ReactNode;
}

/**
 * Header button with a Phosphor icon. No background of our own: on iOS 26
 * the system wraps header items in its circular glass (native look).
 */
export function HeaderButton({ icon, accessibilityLabel, onPress, children }: HeaderButtonProps) {
  const { spacing } = useAppTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={spacing.s8}>
      {children ?? (icon ? <Icon name={icon} color="text" /> : null)}
    </Pressable>
  );
}
