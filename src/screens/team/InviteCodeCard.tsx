import * as Clipboard from 'expo-clipboard';
import type { ReactNode } from 'react';
import { Pressable, Share } from 'react-native';

import { Box, Button, Card, Icon, Text, TextButton, Toast, useToast, Spinner } from '@components';
import type { CodeType } from '@domain/Gym';
import { useAppTheme } from '@theme';
import { joinCodeMessage } from '@utils/deepLinks';
import { haptics } from '@utils/haptics';

const COPY: Record<CodeType, { label: string; hint: string }> = {
  student: { label: 'Código de aluno', hint: 'Quem entrar com ele pede para ser aluno. Professores e o proprietário aprovam.' },
  instructor: { label: 'Código de professor', hint: 'Quem entrar com ele pede para ser professor. Só você aprova.' },
};

/**
 * One invite code (fixed, reusable): big code (tap copies it, with a small
 * popup), "Compartilhar" and, for the owner, "Gerar novo código". Used by
 * Convites (owner) and Equipe → Convidar (owner and professors).
 */
export function InviteCodeCard({
  codeType,
  code,
  loading,
  gymName,
  onRegenerate,
  regenerating = false,
}: {
  codeType: CodeType;
  code: string | undefined;
  loading: boolean;
  gymName: string;
  /** Owner only; the parent confirms first. */
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const { size, spacing } = useAppTheme();
  // Local: inside a sheet an app-wide popup would sit under the modal on iOS.
  const toast = useToast();
  const { label, hint } = COPY[codeType];

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    haptics.success();
    toast.show('Código copiado para a área de transferência');
  };

  return (
    <Card gap="s12">
      <Box>
        <CopyArea onPress={code ? () => void copy() : undefined} code={code} label={label}>
          <Text variant="captionCaps">{label}</Text>
          {loading ? <Spinner /> : null}
          {code ? (
            <Text variant="displayLg" letterSpacing={4}>
              {code}
            </Text>
          ) : null}
          {code ? (
            <Box flexDirection="row" alignItems="center" gap="s4">
              <Icon name="copy" color="textMuted" size={size.badgeIcon} />
              <Text variant="caption">Toque para copiar</Text>
            </Box>
          ) : null}
        </CopyArea>
        {toast.message ? (
          // Floats over the code, where the finger was.
          <Box position="absolute" left={0} right={0} bottom={-spacing.s8} alignItems="center" pointerEvents="none">
            <Toast message={toast.message} />
          </Box>
        ) : null}
      </Box>
      <Text variant="caption" textAlign="center">
        {hint}
      </Text>
      <Button
        title="Compartilhar"
        icon="share"
        variant="secondary"
        disabled={!code}
        onPress={() => code && void Share.share({ message: joinCodeMessage(gymName, code, codeType) })}
      />
      {onRegenerate ? (
        <TextButton title="Gerar novo código" color="danger" disabled={!code || regenerating} onPress={onRegenerate} />
      ) : null}
    </Card>
  );
}

/** The code area: tappable to copy. */
function CopyArea({
  onPress,
  code,
  label,
  children,
}: {
  onPress?: () => void;
  code: string | undefined;
  label: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={code ? `${label}: ${code.split('').join(' ')}. Toque para copiar` : label}
    >
      <Box alignItems="center" gap="s8">
        {children}
      </Box>
    </Pressable>
  );
}
