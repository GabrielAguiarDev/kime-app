import { CameraView } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Box, Icon, Text, TextButton } from '@components';
import { useAppTheme } from '@theme';

/** Side of the square guide, as a share of the screen width. */
const GUIDE_RATIO = 0.68;
/** Length of each corner bracket of the guide. */
const CORNER = 36;

/**
 * QR scanner for pairing a TV: a sheet of its own (iOS page sheet, full screen on Android)
 * with a header, a hint, the camera with a square guide and a way back to typing the code.
 * The caller hides its own sheet first and shows it again from `onDismissed` (iOS ignores
 * a modal presented while another one is still dismissing).
 */
export function TvQrScanner({
  visible,
  onScanned,
  onCancel,
  onDismissed,
}: {
  visible: boolean;
  /** Raw QR data; return true when it holds a valid code (the scanner then stops reading). */
  onScanned: (data: string) => boolean;
  onCancel: () => void;
  /** Modal fully gone (iOS: after UIKit's dismissal). */
  onDismissed: () => void;
}) {
  const { spacing, colors, borderRadii: radii } = useAppTheme();
  const { width } = useWindowDimensions();
  // The camera reports the same QR many times per second: accept only the first valid one.
  const done = useRef(false);
  const guide = Math.round(width * GUIDE_RATIO);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // iOS: native page sheet. Android has none: a transparent modal with our own sheet
      // (rounded top, dimmed strip of the screen above it).
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      transparent={Platform.OS === 'android'}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => {
        done.current = false;
      }}
      onRequestClose={onCancel}
      onDismiss={onDismissed}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.fill, Platform.OS === 'android' ? { backgroundColor: colors.scrim, paddingTop: spacing.s12 } : null]}
          edges={Platform.OS === 'android' ? ['top'] : []}
        >
          <SafeAreaView
            style={[styles.fill, styles.sheet, { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg }]}
            edges={['bottom']}
          >
            {/* Header: close on the left, centered title. */}
            <Box flexDirection="row" alignItems="center" paddingHorizontal="screenMargin" paddingVertical="s16">
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                hitSlop={spacing.s8}
                style={styles.close}
              >
                <Box
                  width={40}
                  height={40}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="bg"
                  style={{ borderRadius: 20 }}
                >
                  <Icon name="close" />
                </Box>
              </Pressable>
              <Text variant="navTitle" flex={1} textAlign="center" accessibilityRole="header">
                Escanear QR
              </Text>
              {/* Balances the close button so the title stays centered. */}
              <Box width={40} />
            </Box>

            <Box paddingHorizontal="s32" paddingTop="s8" paddingBottom="s24">
              <Text variant="body" color="textMuted" textAlign="center">
                Abra o Kimi na TV e aponte a câmera para o QR que aparece na tela.
              </Text>
            </Box>

            <Box flex={1} alignItems="center" justifyContent="center" overflow="hidden">
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => {
                  if (done.current) return;
                  if (onScanned(data)) done.current = true;
                }}
              />
              <ScanGuide side={guide} />
            </Box>

            <Box alignItems="center" paddingVertical="s24">
              <TextButton title="Digitar o código" onPress={onCancel} />
            </Box>
          </SafeAreaView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** Square guide drawn as four corner brackets (decorative: hidden from screen readers). */
function ScanGuide({ side }: { side: number }) {
  const { colors, border } = useAppTheme();
  const w = border.edgeWidth;
  const r = 14;
  const base = { position: 'absolute' as const, width: CORNER, height: CORNER, borderColor: colors.onAccent };
  return (
    <Box width={side} height={side} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Box style={[base, { top: 0, left: 0, borderTopWidth: w, borderLeftWidth: w, borderTopLeftRadius: r }]} />
      <Box style={[base, { top: 0, right: 0, borderTopWidth: w, borderRightWidth: w, borderTopRightRadius: r }]} />
      <Box style={[base, { bottom: 0, left: 0, borderBottomWidth: w, borderLeftWidth: w, borderBottomLeftRadius: r }]} />
      <Box style={[base, { bottom: 0, right: 0, borderBottomWidth: w, borderRightWidth: w, borderBottomRightRadius: r }]} />
    </Box>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  close: { width: 40 },
  sheet: { overflow: 'hidden' },
});
