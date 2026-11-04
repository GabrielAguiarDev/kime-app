import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, CodeField, EmptyState, Screen, SelectionCard, Text, TextField } from '@components';
import {
  isValidEmail,
  isValidOtp,
  isValidPassword,
  OTP_LENGTH,
  PASSWORD_MIN_LENGTH,
  useChangePassword,
  useRequestEmailChange,
  useVerifyEmailChange,
} from '@domain/Auth';
import {
  formatBirthDate,
  maskBirthDate,
  parseBirthDate,
  SEX_OPTIONS,
  useMyProfile,
  useUpdatePersonalData,
  type Profile,
  type Sex,
} from '@domain/Profile';
import { HEIGHT_RANGE_CM, parseDecimal, WEIGHT_RANGE_KG } from '@domain/Water';
import { errorMessage } from '@infra';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

/** Local date `YYYY-MM-DD` of the device (only to reject future birth dates). */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Perfil → Conta → Meus dados: personal data (name, sex, birth date, weight,
 * height), e-mail (confirmed by code) and password. Each block saves on its own.
 */
export function MyDataScreen() {
  const { session, userId } = useSession();
  const profile = useMyProfile(userId);
  const back = () => router.back();
  const email = session?.user.email ?? '';
  // Apple-only accounts have no password yet: they set one without the current.
  const hasPassword = (session?.user.app_metadata?.providers as string[] | undefined)?.includes('email') ?? true;

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
          <EmailSection email={email} />
          <PasswordSection email={email} hasPassword={hasPassword} />
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

  const dirty =
    trimmed !== profile.fullName ||
    sex !== profile.sex ||
    birthDate !== profile.birthDate ||
    weightKg !== profile.weightKg ||
    heightCm !== profile.heightCm;
  const valid = !nameError && !birthError && !weightError && !heightError;

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
      <Box gap="s8">
        <Text variant="caption">Sexo</Text>
        {SEX_OPTIONS.map((o) => (
          <SelectionCard key={o.value} label={o.label} selected={sex === o.value} onPress={() => setSex(o.value)} />
        ))}
      </Box>
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
      </Box>
      <Text variant="caption">O peso também define sua meta de água.</Text>
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
            { fullName: trimmed, sex, birthDate, weightKg, heightCm },
            { onSuccess: () => haptics.success() },
          )
        }
      />
    </Box>
  );
}

// ----------------------------------------------------------------- e-mail ---
function EmailSection({ email }: { email: string }) {
  const request = useRequestEmailChange();
  const verify = useVerifyEmailChange();
  const [newEmail, setNewEmail] = useState('');
  // Address whose code is being typed: the new one, then (secure change) the current one.
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [done, setDone] = useState(false);

  const target = newEmail.trim().toLowerCase();
  const canRequest = isValidEmail(target) && target !== email.toLowerCase();

  const submitCode = (digits: string) => {
    if (!codeFor || !isValidOtp(digits)) return;
    verify.mutate(
      { email: codeFor, code: digits },
      {
        onSuccess: (result) => {
          setCode('');
          if (result.pendingEmail) {
            // The other address still has to confirm.
            setCodeFor(codeFor === target ? email : target);
            return;
          }
          haptics.success();
          setCodeFor(null);
          setNewEmail('');
          setDone(true);
        },
      },
    );
  };

  return (
    <Box gap="s16">
      <Text variant="captionCaps">E-mail</Text>
      <Card gap="s4">
        <Text variant="caption">E-mail atual</Text>
        <Text variant="bodyStrong">{email}</Text>
      </Card>
      {done ? (
        <Text variant="body" color="success">
          E-mail alterado.
        </Text>
      ) : null}

      {codeFor ? (
        <Box gap="s12">
          <Text variant="body" color="textMuted">
            {`Digite o código de ${OTP_LENGTH} dígitos que enviamos para ${codeFor}.`}
          </Text>
          <CodeField
            label="Código"
            kind="digits"
            length={OTP_LENGTH}
            value={code}
            onChangeText={setCode}
            onComplete={submitCode}
            autoFocus
            errorMessage={verify.error ? errorMessage(verify.error) : undefined}
          />
          <Button
            title="Confirmar código"
            disabled={!isValidOtp(code)}
            loading={verify.isPending}
            onPress={() => submitCode(code)}
          />
          <Button
            title="Cancelar"
            variant="secondary"
            disabled={verify.isPending}
            onPress={() => {
              setCodeFor(null);
              setCode('');
              verify.reset();
            }}
          />
        </Box>
      ) : (
        <Box gap="s12">
          <TextField
            label="Novo e-mail"
            value={newEmail}
            onChangeText={(t) => {
              setNewEmail(t);
              setDone(false);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            errorMessage={request.error ? errorMessage(request.error) : undefined}
          />
          <Button
            title="Alterar e-mail"
            variant="secondary"
            disabled={!canRequest}
            loading={request.isPending}
            onPress={() =>
              request.mutate(target, {
                onSuccess: () => {
                  verify.reset();
                  setCodeFor(target);
                },
              })
            }
          />
        </Box>
      )}
    </Box>
  );
}

// --------------------------------------------------------------- password ---
function PasswordSection({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);

  const nextError = next && !isValidPassword(next) ? `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` : undefined;
  const confirmError = confirmation && confirmation !== next ? 'As senhas não são iguais.' : undefined;
  const valid = (!hasPassword || current.length > 0) && isValidPassword(next) && confirmation === next;

  return (
    <Box gap="s16">
      <Text variant="captionCaps">Senha</Text>
      {hasPassword ? (
        <TextField
          label="Senha atual"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
        />
      ) : (
        <Text variant="body" color="textMuted">
          Sua conta entra com a Apple. Defina uma senha para entrar também com e-mail.
        </Text>
      )}
      <TextField
        label="Nova senha"
        value={next}
        onChangeText={(t) => {
          setNext(t);
          setDone(false);
        }}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        errorMessage={nextError}
      />
      <TextField
        label="Confirmar nova senha"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        errorMessage={confirmError}
      />
      {change.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(change.error)}
        </Text>
      ) : null}
      {done ? (
        <Text variant="body" color="success">
          Senha alterada.
        </Text>
      ) : null}
      <Button
        title={hasPassword ? 'Alterar senha' : 'Definir senha'}
        variant="secondary"
        disabled={!valid}
        loading={change.isPending}
        onPress={() =>
          change.mutate(
            { email, currentPassword: hasPassword ? current : null, newPassword: next },
            {
              onSuccess: () => {
                haptics.success();
                setCurrent('');
                setNext('');
                setConfirmation('');
                setDone(true);
              },
            },
          )
        }
      />
    </Box>
  );
}
