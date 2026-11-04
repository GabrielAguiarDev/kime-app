import { Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView } from "react-native";
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
}

export function Screen({
  children,
  title,
  scrollable = true,
  footer,
  feedback,
  bottomInset = true,
  onBack,
  topAction,
  nativeHeader = false,
  headerLeft,
  headerRight,
  largeTitle = true,
}: ScreenProps) {
  const { bottom } = useSafeAreaInsets();
  const { spacing, size, colors } = useAppTheme();
  const paddingBottom = (bottomInset ? bottom : 0) + spacing.s16;
  const hasBottom = !!footer || !!feedback;

  if (nativeHeader) {
    return (
      <NativeHeaderScreen
        title={title}
        onBack={onBack}
        topAction={topAction}
        headerLeft={headerLeft}
        headerRight={headerRight}
        largeTitle={largeTitle}
        footer={footer}
        feedback={feedback}
        bottomInset={bottomInset}
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
 */
function NativeHeaderScreen({
  children,
  title,
  onBack,
  topAction,
  headerLeft,
  headerRight,
  largeTitle = true,
  footer,
  feedback,
  bottomInset = true,
}: Omit<ScreenProps, "nativeHeader" | "scrollable">) {
  const { bottom } = useSafeAreaInsets();
  const { spacing, colors } = useAppTheme();
  const [bottomHeight, setBottomHeight] = useState(0);
  const safeBottom = (bottomInset ? bottom : 0) + spacing.s16;
  const bottomContent = feedback ?? (footer ? (
    <Box paddingHorizontal="screenMargin" paddingTop="s12" style={{ paddingBottom: safeBottom }} gap="s12">
      {footer}
    </Box>
  ) : null);

  const left = headerLeft ?? (onBack ? <HeaderButton icon="back" accessibilityLabel="Voltar" onPress={onBack} /> : null);
  const right =
    headerRight ??
    (topAction ? (
      <HeaderButton icon={topAction.icon} accessibilityLabel={topAction.accessibilityLabel} onPress={topAction.onPress} />
    ) : null);

  return (
    <>
      {/* Only text in `title`: the system shows it large at rest and small (centered) once collapsed. */}
      <Stack.Screen
        options={{
          title: title ?? "",
          headerLargeTitleEnabled: largeTitle,
          headerBackVisible: !left,
          headerLeft: left ? () => left : undefined,
          headerRight: right ? () => right : undefined,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.screenMargin,
          paddingBottom: bottomContent ? bottomHeight + spacing.s16 : safeBottom,
        }}
      >
        {children}
      </ScrollView>
      {bottomContent ? (
        <Box
          position="absolute"
          left={0}
          right={0}
          bottom={0}
          backgroundColor="bg"
          onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height)}
        >
          {bottomContent}
        </Box>
      ) : null}
    </>
  );
}
