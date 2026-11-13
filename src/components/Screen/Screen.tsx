import { Stack } from "expo-router";
import { HeaderHeightContext } from "expo-router/react-navigation";
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Platform, Pressable, ScrollView, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@theme";

import { Box } from "../Box/Box";
import { Icon, type IconName } from "../Icon/Icon";
import { HeaderButton } from "../NativeHeader/NativeHeader";
import { Text } from "../Text/Text";

interface ScreenProps {
  children: ReactNode;
  title?: string;
  /** Scrollable content (default true). Scroll indicators are always hidden (3.12). */
  scrollable?: boolean;
  /** Fixed content under the scroll area (e.g. primary action). */
  footer?: ReactNode;
  /**
   * nativeHeader + scrollable: content at the END of the scroll (never fixed):
   * after the last item when the content scrolls, at the bottom of the screen
   * when it is short. E.g. "Na academia desde …".
   */
  endFooter?: ReactNode;
  /** Full-width feedback sheet at the bottom (3.10). Replaces `footer` and handles the bottom inset. */
  feedback?: ReactNode;
  /** Set false when the screen sits above the tab bar (bottom inset handled by tabs). */
  bottomInset?: boolean;
  /** Shows a back arrow at the top-left, away from the primary actions. */
  onBack?: () => void;
  /** Icon-only action at the top-right (e.g. settings). */
  topAction?: { icon: IconName; accessibilityLabel: string; onPress: () => void };
  /**
   * The route has the native Stack header (tabs and inner screens, see
   * useNativeHeaderOptions): `title` becomes the large/compact header title,
   * `onBack` / `topAction` become circular header buttons, and the scroll
   * view adjusts its insets to the header by itself (no manual top padding,
   * no title inside the content).
   */
  nativeHeader?: boolean;
  /** nativeHeader: custom left item (replaces the back button), e.g. the academy logo. */
  headerLeft?: ReactNode;
  /** nativeHeader: custom right item (wins over `topAction`). */
  headerRight?: ReactNode;
  /** nativeHeader (iOS): large title that collapses (default true). False = compact bar only. */
  largeTitle?: boolean;
  /** nativeHeader: second line under the title (e.g. the modality). Uses the compact bar (no large title). */
  subtitle?: string;
  /** Without nativeHeader: content above the title (e.g. the signed-in account row). */
  header?: ReactNode;
  /** Scroll events of the content (throttled), e.g. to pin a row that left the screen. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function Screen({
  children,
  title,
  scrollable = true,
  footer,
  endFooter,
  feedback,
  bottomInset = true,
  onBack,
  topAction,
  nativeHeader = false,
  headerLeft,
  headerRight,
  largeTitle = true,
  subtitle,
  header: topContent,
  onScroll,
}: ScreenProps) {
  const { bottom } = useSafeAreaInsets();
  const { spacing, size, colors } = useAppTheme();
  const paddingBottom = (bottomInset ? bottom : 0) + spacing.s16;
  const hasBottom = !!footer && !feedback;

  if (nativeHeader) {
    return (
      <NativeHeaderScreen
        title={title}
        scrollable={scrollable}
        onBack={onBack}
        topAction={topAction}
        headerLeft={headerLeft}
        headerRight={headerRight}
        largeTitle={largeTitle}
        subtitle={subtitle}
        footer={footer}
        endFooter={endFooter}
        feedback={feedback}
        bottomInset={bottomInset}
        onScroll={onScroll}
      >
        {children}
      </NativeHeaderScreen>
    );
  }

  const backButton = onBack ? (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={spacing.s8}
      style={{
        width: size.touchTarget,
        height: size.touchTarget,
        justifyContent: "center",
        marginLeft: -spacing.s8,
        paddingLeft: spacing.s8,
      }}
    >
      <Icon name="back" />
    </Pressable>
  ) : null;

  const actionButton = topAction ? (
    <Pressable
      onPress={topAction.onPress}
      accessibilityRole="button"
      accessibilityLabel={topAction.accessibilityLabel}
      hitSlop={spacing.s8}
      style={{
        width: size.touchTarget,
        height: size.touchTarget,
        justifyContent: "center",
        alignItems: "flex-end",
        marginRight: -spacing.s8,
        paddingRight: spacing.s8,
      }}
    >
      <Icon name={topAction.icon} />
    </Pressable>
  ) : null;

  // Back on the left, action on the right, on the same row above the title.
  const topRow =
    backButton || actionButton ? (
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        style={{ marginBottom: spacing.s8 }}
      >
        {backButton ?? <Box />}
        {actionButton}
      </Box>
    ) : null;

  const header = (
    <>
      {topRow}
      {topContent ? <Box marginBottom="s24">{topContent}</Box> : null}
      {title ? (
        <Text variant="title" marginBottom="s24" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </>
  );

  return (
    // No KeyboardAvoidingView: the footer stays at the bottom (under the
    // keyboard) instead of riding up over the fields. Only the scroll area
    // makes room, so the focused field stays visible.
    //
    // Top safe area applied ONCE, here: SafeAreaView pads only the part of the
    // view that actually sits under the status bar / Dynamic Island, so it
    // never adds up with anything a parent already applied. No navigator
    // header exists (headerShown: false everywhere). Content starts at the safe area.
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
    <Box
      flex={1}
      backgroundColor="bg"
    >
      {scrollable ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 64 : undefined}
          contentContainerStyle={{
            paddingHorizontal: spacing.screenMargin,
            paddingBottom: hasBottom ? spacing.s16 : paddingBottom,
            flexGrow: 1,
          }}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <Box
          flex={1}
          paddingHorizontal="screenMargin"
          style={{ paddingBottom: hasBottom ? 0 : paddingBottom }}
        >
          {header}
          {children}
        </Box>
      )}
      {feedback ??
        (footer ? (
          <Box
            paddingHorizontal="screenMargin"
            style={{ paddingBottom }}
            gap="s12"
          >
            {footer}
          </Box>
        ) : null)}
    </Box>
    </SafeAreaView>
  );
}

/**
 * Screen under the native Stack header (iOS large title / Android compact).
 *
 * The ScrollView is the ROOT native view of the screen: react-native-screens
 * finds the scroll view by walking the FIRST subview chain, and only then
 * does the large title follow the scroll and collapse. So there is no wrapper
 * view, no SafeAreaView and no manual top padding: the scroll view adjusts
 * its insets to the header (contentInsetAdjustmentBehavior="automatic").
 * Footer / feedback sheet float over the bottom (a later sibling, on `bg`),
 * and the content gets bottom room for them.
 *
 * Render it on the screen's FIRST render (a loading state inside it, never
 * `return null` before it): iOS only offsets the scroll view below the large
 * title when it exists as the screen appears. Mounted later, it starts at
 * offset 0, hidden under the header (seen on a device, 2026-11-06).
 */
function NativeHeaderScreen({
  children,
  title,
  onBack,
  topAction,
  headerLeft,
  headerRight,
  largeTitle = true,
  subtitle,
  scrollable = true,
  footer,
  endFooter,
  feedback,
  bottomInset = true,
  onScroll,
}: Omit<ScreenProps, "nativeHeader">) {
  const { bottom, top } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Context, not useHeaderHeight(): that one throws outside a navigator with a header.
  // On the first render it can still be the compact height (or 0); the floor keeps the
  // end footer's min height from ever exceeding the visible area (see endFooter below).
  const contextHeaderHeight = useContext(HeaderHeightContext) ?? 0;
  const headerHeight = Math.max(
    contextHeaderHeight,
    Platform.OS === "ios" ? top + (largeTitle && !subtitle ? IOS_LARGE_HEADER : IOS_COMPACT_HEADER) : 0,
  );
  const { spacing, colors } = useAppTheme();
  const [bottomHeight, setBottomHeight] = useState(0);
  const safeBottom = (bottomInset ? bottom : 0) + spacing.s16;
  // Android: the compact header has no large title to space the content from it.
  const contentTop = Platform.OS === "android" ? spacing.s16 : 0;
  const bottomContent = !feedback && footer ? (
    <Box paddingHorizontal="screenMargin" paddingTop="s12" style={{ paddingBottom: safeBottom }} gap="s12">
      {footer}
    </Box>
  ) : null;

  // Android: chevron (no stem) and room before the title, which the native header puts right after it.
  const left =
    headerLeft ??
    (onBack ? (
      Platform.OS === "android" ? (
        <Box marginRight="s12">
          <HeaderButton icon="chevronLeft" accessibilityLabel="Voltar" onPress={onBack} />
        </Box>
      ) : (
        <HeaderButton icon="back" accessibilityLabel="Voltar" onPress={onBack} />
      )
    ) : null);
  const right =
    headerRight ??
    (topAction ? (
      <HeaderButton icon={topAction.icon} accessibilityLabel={topAction.accessibilityLabel} onPress={topAction.onPress} />
    ) : null);
  const renderLeft = useHeaderSlot(left);
  const renderRight = useHeaderSlot(right);

  // Sent to the native header ONLY when something in it really changes. A new
  // options object on every render made expo-router call setOptions each time,
  // and every reconfiguration of the iOS large-title bar could leave the scroll
  // view offset under a collapsed bar (screen "scrolled down" until the next
  // layout). The header items change through their slots, without setOptions.
  const options = useMemo(
    () => ({
      title: title ?? "",
      headerLargeTitleEnabled: largeTitle && !subtitle,
      headerTitle: subtitle
        ? () => (
            <Box alignItems={Platform.OS === "ios" ? "center" : "flex-start"}>
              <Text variant="navTitle" numberOfLines={1}>{title}</Text>
              <Text variant="caption" numberOfLines={1}>{subtitle}</Text>
            </Box>
          )
        : undefined,
      headerBackVisible: !renderLeft,
      headerLeft: renderLeft,
      headerRight: renderRight,
    }),
    [title, largeTitle, subtitle, renderLeft, renderRight],
  );

  return (
    <>
      {/* Only text in `title`: the system shows it large at rest and small (centered) once collapsed. */}
      <Stack.Screen options={options} />
      {scrollable ? <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? 64 : undefined}
        // No flexGrow: with automatic insets (header on top, tab bar below) a
        // content stretched to the frame height ends up taller than the
        // visible area by the insets, so short/empty screens would scroll.
        contentContainerStyle={{
          paddingHorizontal: spacing.screenMargin,
          paddingTop: contentTop,
          paddingBottom: bottomContent ? bottomHeight + spacing.s16 : safeBottom,
        }}
      >
        {endFooter ? (
          // Visible height of the scroll (screen minus the header and the bottom
          // safe area the automatic insets add) minus its own bottom padding: a
          // short content still puts the end footer at the bottom, without
          // making the screen scroll.
          <Box
            style={{
              minHeight: Math.max(
                0,
                windowHeight - headerHeight - contentTop - (bottomInset ? bottom : 0) -
                  (bottomContent ? bottomHeight + spacing.s16 : safeBottom),
              ),
            }}
          >
            {children}
            <Box style={{ marginTop: "auto" }} paddingTop="s32">
              {endFooter}
            </Box>
          </Box>
        ) : (
          children
        )}
      </ScrollView> : children}
      {feedback}
      {bottomContent ? (
        <Box
          position="absolute"
          left={0}
          right={0}
          bottom={0}
          backgroundColor="bg"
        >
          {/* iOS native tabs: the screen runs under the glass tab bar, so lift the
              footer by the native bottom safe area (which includes the bar). Only the
              content is measured: the scroll's automatic inset already covers the bar. */}
          <SafeAreaView edges={Platform.OS === "ios" && !bottomInset ? ["bottom"] : []}>
            <Box onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height)}>{bottomContent}</Box>
          </SafeAreaView>
        </Box>
      ) : null}
    </>
  );
}

/** iOS navigation bar heights under the status bar: compact, and with the large title. */
const IOS_COMPACT_HEADER = 44;
const IOS_LARGE_HEADER = 96;

interface SlotStore {
  get: () => ReactNode;
  set: (node: ReactNode) => void;
  subscribe: (listener: () => void) => () => void;
}

function createSlotStore(initial: ReactNode): SlotStore {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (node) => {
      value = node;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function HeaderSlot({ store }: { store: SlotStore }) {
  const node = useSyncExternalStore(store.subscribe, store.get, store.get);
  return <>{node}</>;
}

/**
 * A header item (left / right) with a STABLE render function: the native
 * header gets it once (or when the item appears / goes away) and the content
 * follows each render through the store. Undefined when there is no item.
 */
function useHeaderSlot(node: ReactNode): (() => ReactNode) | undefined {
  const [store] = useState(() => createSlotStore(node));
  useLayoutEffect(() => {
    store.set(node);
  });
  const render = useCallback(() => <HeaderSlot store={store} />, [store]);
  return node == null || node === false ? undefined : render;
}
