import { useEffect, useState, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { useAppTheme } from "@theme";

import { Box } from "../Box/Box";

// Motion (user decision: the bottom sheet is the exception to "no animations").
const OPEN_MS = 280;
const CLOSE_MS = 200;
/** Drag past this share of the sheet height, or fling down, to dismiss. */
const DISMISS_RATIO = 0.25;
const DISMISS_VELOCITY = 900;
/** Landscape: the sheet is centered at this width, clear of the notch side. */
const LANDSCAPE_SHEET_WIDTH = 480;

interface BottomSheetProps {
  visible: boolean;
  /** User asked to close (drag down, tap outside, Android back). */
  onRequestClose: () => void;
  /** Exit motion finished: safe to unmount the content. */
  onClosed?: () => void;
  /** Accessibility label of the dimmed area that closes the sheet. */
  dismissLabel?: string;
  /** iOS: also present in landscape (default portrait only, like the app). The running timer may be landscape. */
  allowLandscape?: boolean;
  children: ReactNode;
}

/**
 * Bottom sheet: dimmed screen, sheet rising from the bottom (surface, 2px top
 * border, radius-lg on top) with a grab handle. Drag down or tap outside to
 * close. Content stays mounted during the exit motion.
 */
export function BottomSheet({
  visible,
  onRequestClose,
  onClosed,
  dismissLabel = "Fechar",
  allowLandscape = false,
  children,
}: BottomSheetProps) {
  const theme = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const landscape = windowWidth > windowHeight;
  const reduceMotion = useReducedMotion();

  const [mounted, setMounted] = useState(visible);
  // Native modal shown. Goes false after the exit motion; on iOS the content
  // unmounts (and onClosed fires) only once UIKit finished dismissing it:
  // presenting another controller before that (image picker, share sheet) is
  // silently ignored on a real device.
  const [presented, setPresented] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(0);
  // 0 = open, sheet height (or window height before measuring) = hidden.
  const offset = useSharedValue(windowHeight);
  const hiddenOffset = sheetHeight || windowHeight;

  if (visible && !mounted) setMounted(true);
  if (visible && !presented) setPresented(true);

  const unmount = () => {
    if (visible) return; // reopened meanwhile
    setMounted(false);
    setSheetHeight(0);
    onClosed?.();
  };

  // Callers often drop the content as soon as they close the sheet
  // ({open ? <Form /> : null}). While the exit motion runs, keep showing the
  // last content and keep the measured height: otherwise the sheet shrinks to
  // the handle, the exit is recomputed from that height and the sheet seems
  // to vanish instead of sliding down (most visible after a drag-to-dismiss).
  // (Adjusted while rendering, not in an effect: it converges in one pass.)
  const [lastChildren, setLastChildren] = useState(children);
  if (visible && lastChildren !== children) setLastChildren(children);
  const content = visible ? children : lastChildren;

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      if (!sheetHeight) return; // wait for the first layout to slide from the real height
      if (offset.get() > sheetHeight) offset.set(sheetHeight);
      offset.set(
        reduceMotion
          ? 0
          : withTiming(0, {
              duration: OPEN_MS,
              easing: Easing.out(Easing.cubic),
            }),
      );
    } else {
      const finish = () => {
        setPresented(false);
        // iOS: unmount from the Modal's onDismiss.
        if (Platform.OS !== "ios") unmount();
      };
      if (reduceMotion) {
        offset.set(hiddenOffset);
        finish();
        return;
      }
      offset.set(
        withTiming(
          hiddenOffset,
          { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
          (done) => {
            if (done) scheduleOnRN(finish);
          },
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted, sheetHeight, reduceMotion]);

  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (e) => {
      "worklet";
      // Only downwards; a little resistance upwards keeps it feeling attached.
      offset.set(e.translationY > 0 ? e.translationY : e.translationY / 6);
    },
    onDeactivate: (e) => {
      "worklet";
      const height = sheetHeight || windowHeight;
      if (
        e.translationY > height * DISMISS_RATIO ||
        e.velocityY > DISMISS_VELOCITY
      ) {
        scheduleOnRN(onRequestClose);
      } else {
        offset.set(withSpring(0, { damping: 22, stiffness: 260 }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, hiddenOffset], [1, 0], "clamp"),
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible={presented}
      onDismiss={unmount}
      transparent
      animationType="none"
      statusBarTranslucent
      supportedOrientations={allowLandscape ? ['portrait', 'landscape'] : ['portrait']}
      onRequestClose={onRequestClose}
    >
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.scrim },
            scrimStyle,
          ]}
        >
          <Pressable
            style={styles.fill}
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
          />
        </Animated.View>
        <Box flex={1} justifyContent="flex-end" pointerEvents="box-none">
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[sheetStyle, landscape ? { alignSelf: 'center', width: Math.min(windowWidth, LANDSCAPE_SHEET_WIDTH) } : null]}
              accessibilityViewIsModal
              onLayout={(e) => {
                if (visible) setSheetHeight(e.nativeEvent.layout.height);
              }}
            >
              <Box
                backgroundColor="surface"
                borderTopWidth={theme.border.width}
                borderLeftWidth={theme.border.width}
                borderRightWidth={theme.border.width}
                borderColor="border"
                borderTopLeftRadius="lg"
                borderTopRightRadius="lg"
                paddingHorizontal="screenMargin"
                style={{ paddingBottom: bottom + theme.spacing.s16 }}
              >
                <Box alignItems="center" paddingTop="s12" paddingBottom="s16">
                  <Box
                    width={theme.size.sheetHandleWidth}
                    height={theme.size.sheetHandleHeight}
                    borderRadius="sm"
                    backgroundColor="border"
                  />
                </Box>
                {content}
              </Box>
            </Animated.View>
          </GestureDetector>
        </Box>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
