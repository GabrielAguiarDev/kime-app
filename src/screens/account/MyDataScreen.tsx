import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, useWindowDimensions } from 'react-native';

import { BottomSheet, Box, Button, Card, EmptyState, Icon, Screen, SelectionCard, Text, TextButton, TextField } from '@components';
import { useDeleteAccount } from '@domain/Auth';
import {
  formatBirthDate,
  maskBirthDate,
  parseBirthDate,
  REACH_RANGE_CM,
  SEX_OPTIONS,
  useMyProfile,
  useUpdatePersonalData,
  type Profile,
  type Sex,
} from '@domain/Profile';
import { HEIGHT_RANGE_CM, parseDecimal, WEIGHT_RANGE_KG } from '@domain/Water';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { useHasPassword } from './ChangePasswordScreen';

/** Local date `YYYY-MM-DD` of the device (only to reject future birth dates). */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Below this width the reach goes under weight and height (three fields get too narrow). */
const BODY_ROW_MIN_WIDTH = 390;

/**
 * Perfil → Conta → Meus dados: personal data (name, sex, birth date, weight,
 * height, reach), then the access rows (E-mail, Senha: their own screens) and
 * account deletion.
 */
export function MyDataScreen() {
  const { session, userId } = useSession();
  const profile = useMyProfile(userId);
  const back = () => router.back();
  const email = session?.user.email ?? '';
  const hasPassword = useHasPassword();

  return (
    <Screen nativeHeader title="Meus dados" onBack={back}>
      {profile.isLoading ? <ActivityIndicator /> : null}
      {profile.isError ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar seus dados"
          action={<Button title="Tentar de novo" variant="secondary" onPress={() => profile.refetch()} />}
        />
      ) : null}
      {profile.data ? (
        <Box gap="s40">
          <PersonalSection key={profile.data.id} userId={userId} profile={profile.data} />
          <Box gap="s12">
            <Text variant="captionCaps">Acesso</Text>
            <AccessRow icon="mail" title="E-mail" detail={email} onPress={() => router.push('/conta/email')} />
            <AccessRow
              icon="locked"
              title={hasPassword ? 'Senha' : 'Definir senha'}
              detail={hasPassword ? 'Alterar senha' : 'Para entrar também com e-mail'}
              onPress={() => router.push('/conta/senha')}
            />
          </Box>
          <DeleteAccountSection avatarPath={profile.data.avatarPath} />
        </Box>
      ) : null}
    </Screen>
  );
}

// -------------------------------------------------------------- personal ---
function PersonalSection({ userId, profile }: { userId: string | undefined; profile: Profile }) {
  const save = useUpdatePersonalData(userId);
  const [name, setName] = useState(profile.fullName);
  const [sex, setSex] = useState<Sex | null>(profile.sex);
  const [birth, setBirth] = useState(formatBirthDate(profile.birthDate));
  const [weight, setWeight] = useState(profile.weightKg ? String(profile.weightKg).replace('.', ',') : '');
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm).replace('.', ',') : '');
  const [reach, setReach] = useState(profile.reachCm ? String(profile.reachCm).replace('.', ',') : '');
  const { width } = useWindowDimensions();
  const oneRow = width >= BODY_ROW_MIN_WIDTH;

  const trimmed = name.trim();
  const nameError = trimmed.length < 1 || trimmed.length > 80 ? 'Informe seu nome (até 80 caracteres).' : undefined;
  const birthDate = birth.trim() ? parseBirthDate(birth, todayIso()) : null;
  const birthError = birth.trim() && !birthDate ? 'Use uma data válida no formato DD/MM/AAAA.' : undefined;
  const weightKg = weight.trim() ? parseDecimal(weight) : null;
  const weightError =
    weight.trim() && (weightKg === null || weightKg < WEIGHT_RANGE_KG.min || weightKg > WEIGHT_RANGE_KG.max)
      ? `Informe um peso entre ${WEIGHT_RANGE_KG.min} e ${WEIGHT_RANGE_KG.max} kg.`
      : undefined;
  const heightCm = height.trim() ? parseDecimal(height) : null;
  const heightError =
    height.trim() && (heightCm === null || heightCm < HEIGHT_RANGE_CM.min || heightCm > HEIGHT_RANGE_CM.max)
      ? `Informe uma altura entre ${HEIGHT_RANGE_CM.min} e ${HEIGHT_RANGE_CM.max} cm.`
      : undefined;
  const reachCm = reach.trim() ? parseDecimal(reach) : null;
  const reachError =
    reach.trim() && (reachCm === null || reachCm < REACH_RANGE_CM.min || reachCm > REACH_RANGE_CM.max)
      ? `Informe um alcance entre ${REACH_RANGE_CM.min} e ${REACH_RANGE_CM.max} cm.`
      : undefined;

  const dirty =
    trimmed !== profile.fullName ||
    sex !== profile.sex ||
    birthDate !== profile.birthDate ||
    weightKg !== profile.weightKg ||
    heightCm !== profile.heightCm ||
    reachCm !== profile.reachCm;
  const valid = !nameError && !birthError && !weightError && !heightError && !reachError;

  const reachField = (
    <Box flex={1}>
      <TextField
        label="Alcance"
        value={reach}
        onChangeText={setReach}
        keyboardType="decimal-pad"
        unit="cm"
        errorMessage={reachError}
      />
    </Box>
  );

  return (
    <Box gap="s16">
      <Text variant="captionCaps">Dados pessoais</Text>
      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        maxLength={80}
        autoCapitalize="words"
        textContentType="name"
        errorMessage={name.length > 0 ? nameError : undefined}
      />
      <SexField value={sex} onChange={setSex} />
      <TextField
        label="Data de nascimento"
        value={birth}
        onChangeText={(t) => setBirth(maskBirthDate(t))}
        keyboardType="number-pad"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        errorMessage={birth.length === 10 ? birthError : undefined}
      />
      <Box flexDirection="row" gap="s12">
        <Box flex={1}>
          <TextField
            label="Peso"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            unit="kg"
            errorMessage={weightError}
          />
        </Box>
        <Box flex={1}>
          <TextField
            label="Altura"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            unit="cm"
            errorMessage={heightError}
          />
        </Box>
        {oneRow ? reachField : null}
      </Box>
      {oneRow ? null : (
        <Box flexDirection="row" gap="s12">
          {reachField}
          <Box flex={1} />
        </Box>
      )}
      <Box gap="s4">
        <Text variant="caption">O peso também define sua meta de água.</Text>
        <Text variant="caption">Alcance: distância de uma ponta dos dedos à outra, com os braços abertos.</Text>
      </Box>
      {save.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(save.error)}
        </Text>
      ) : null}
      <Button
        title="Salvar dados"
        disabled={!dirty || !valid}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { fullName: trimmed, sex, birthDate, weightKg, heightCm, reachCm },
            { onSuccess: () => haptics.success() },
          )
        }
      />
    </Box>
  );
}

/** Sex as a select: a field like the text inputs that opens a sheet with the options. */
function SexField({ value, onChange }: { value: Sex | null; onChange: (sex: Sex) => void }) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const label = SEX_OPTIONS.find((o) => o.value === value)?.label;
  return (
    <Box gap="s4">
      <Text variant="caption">Sexo</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Sexo: ${label ?? 'não informado'}. Alterar`}
      >
        <Box
          height={52}
          backgroundColor="surface"
          borderRadius="md"
          borderWidth={theme.border.width}
          borderColor="border"
          paddingHorizontal="s16"
          flexDirection="row"
          alignItems="center"
          gap="s8"
        >
          <Text variant="body" color={label ? 'text' : 'textMuted'} flex={1}>
            {label ?? 'Selecione'}
          </Text>
          <Icon name="chevronDown" color="textMuted" size={20} />
        </Box>
      </Pressable>
      <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
        <SheetForm title="Sexo">
          {SEX_OPTIONS.map((o) => (
            <SelectionCard
              key={o.value}
              label={o.label}
              selected={value === o.value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
            />
          ))}
        </SheetForm>
      </BottomSheet>
    </Box>
  );
}

/** A row that opens an access screen (E-mail, Senha). */
function AccessRow({ icon, title, detail, onPress }: { icon: 'mail' | 'locked'; title: string; detail: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${detail}`} flexDirection="row" alignItems="center" gap="s12">
      <Icon name={icon} color="textMuted" />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" numberOfLines={1}>
          {detail}
        </Text>
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}

// ---------------------------------------------------------- delete account ---
/**
 * Deletes the account and every personal record (classes, water, weight,
 * plans). An owner whose academy has other members must transfer it first; an
 * academy where the owner is alone goes with the account.
 */
function DeleteAccountSection({ avatarPath }: { avatarPath: string | null }) {
  const remove = useDeleteAccount();
  const confirm = useConfirm();
  const ask = async () => {
    const ok = await confirm({
      title: 'Excluir sua conta?',
      message:
        'Seu perfil, suas aulas, registros de água, peso e planos são apagados para sempre. Academias em que você é o único membro também são apagadas. Isso não pode ser desfeito.',
      confirmLabel: 'Excluir conta',
      tone: 'danger',
    });
    if (!ok) return;
    // Success signs out: the root guard takes the user to the start screen.
    remove.mutate(avatarPath, { onError: (e) => Alert.alert('Excluir conta', errorMessage(e)) });
  };
  return (
    <Box gap="s12">
      <Text variant="captionCaps">Excluir conta</Text>
      <Text variant="body" color="textMuted">
        Apaga sua conta e todos os seus dados. Se você é proprietário de uma academia com outros membros, transfira a
        academia antes.
      </Text>
      <TextButton title="Excluir conta" color="danger" disabled={remove.isPending} onPress={ask} />
    </Box>
  );
}
