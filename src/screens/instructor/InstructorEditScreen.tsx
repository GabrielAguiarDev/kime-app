import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Switch } from 'react-native';

import { BeltChip, Box, Button, Card, Icon, LoadError, Screen, Text, TextField } from '@components';
import { beltsOf, useBelts, useModalities } from '@domain/Classes';
import {
  BIO_MAX,
  formatWhatsapp,
  isValidInstagram,
  isValidWhatsapp,
  normalizeInstagram,
  normalizeWhatsapp,
  useInstructorProfile,
  useUpdateInstructorProfile,
  type InstructorProfile,
} from '@domain/Instructor';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { InstructorBeltSheet } from './InstructorBeltSheet';

const back = () => router.back();

/**
 * Staff: "Editar perfil" (from their own profile). Bio, contacts and "show to
 * students" are the person's (same in every academy); belts are per modality
 * of the active academy and save on their own (sheet).
 */
export function InstructorEditScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const profile = useInstructorProfile(active?.gymId, userId);

  // Always render the Screen (its ScrollView) on the first render (iOS large title).
  if (!active || profile.isLoading) {
    return (
      <Screen nativeHeader title="Editar perfil" onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen nativeHeader title="Editar perfil" onBack={back}>
        <LoadError title="Não foi possível carregar seu perfil" onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  return <EditForm key={profile.data.membershipId} academyId={active.gymId} profile={profile.data} />;
}

function EditForm({ academyId, profile }: { academyId: string; profile: InstructorProfile }) {
  const { userId } = useSession();
  const { colors, size, spacing } = useAppTheme();
  const save = useUpdateInstructorProfile(userId);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [instagram, setInstagram] = useState(profile.instagram ? `@${profile.instagram}` : '');
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ? formatWhatsapp(profile.whatsapp) : '');
  const [showContacts, setShowContacts] = useState(profile.showContactsToStudents);

  const bioValue = bio.trim() || null;
  const handle = normalizeInstagram(instagram) || null;
  const phone = normalizeWhatsapp(whatsapp) || null;
  const instagramError = handle && !isValidInstagram(handle) ? 'Use só letras, números, ponto e _ (até 30).' : undefined;
  const whatsappError = phone && !isValidWhatsapp(phone) ? 'Informe o número com DDD, ex. (11) 99999-0000.' : undefined;
  const dirty =
    bioValue !== profile.bio ||
    handle !== profile.instagram ||
    phone !== profile.whatsapp ||
    showContacts !== profile.showContactsToStudents;
  const valid = !instagramError && !whatsappError;

  const submit = () =>
    save.mutate(
      { bio: bioValue, instagram: handle, whatsapp: phone, showContactsToStudents: showContacts },
      {
        onSuccess: () => {
          haptics.success();
          router.back();
        },
      },
    );

  return (
    <Screen
      nativeHeader
      title="Editar perfil"
      onBack={back}
      footer={<Button title="Salvar" disabled={!dirty || !valid} loading={save.isPending} onPress={submit} />}
    >
      <Box gap="s40">
        <Box gap="s8">
          <Text variant="captionCaps">Bio</Text>
          <TextField
            label="Sobre você"
            value={bio}
            onChangeText={setBio}
            placeholder="Graduação, tempo de tatame, o que você ensina…"
            maxLength={BIO_MAX}
            multiline
            style={{ minHeight: size.input * 2, textAlignVertical: 'top', paddingTop: spacing.s12, paddingBottom: spacing.s12 }}
          />
          <Text variant="caption" textAlign="right">{`${bio.length}/${BIO_MAX}`}</Text>
        </Box>

        <Box gap="s16">
          <Text variant="captionCaps">Contato</Text>
          <TextField
            label="Instagram"
            value={instagram}
            onChangeText={setInstagram}
            placeholder="@seuperfil"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={60}
            errorMessage={instagramError}
          />
          <TextField
            label="WhatsApp"
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="(11) 99999-0000"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            maxLength={20}
            errorMessage={whatsappError}
          />
          <Card flexDirection="row" alignItems="center" gap="s12">
            <Box flex={1} gap="s4">
              <Text variant="bodyStrong">Mostrar para alunos</Text>
              <Text variant="caption">Os professores da academia sempre veem seus contatos.</Text>
            </Box>
            <Switch
              value={showContacts}
              onValueChange={setShowContacts}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.text}
              ios_backgroundColor={colors.border}
              accessibilityLabel="Mostrar contatos para alunos"
            />
          </Card>
        </Box>

        <BeltsSection academyId={academyId} profile={profile} />

        {save.error ? (
          <Text variant="caption" color="danger">
            {errorMessage(save.error)}
          </Text>
        ) : null}
      </Box>
    </Screen>
  );
}

/** One row per modality with belts: the current belt; tapping opens the belt sheet. */
function BeltsSection({ academyId, profile }: { academyId: string; profile: InstructorProfile }) {
  const modalities = useModalities(academyId);
  const belts = useBelts(academyId);
  const [sheet, setSheet] = useState<string | null>(null);
  const withBelts = (modalities.data ?? []).filter((m) => m.usesBelts);
  if (modalities.isLoading || belts.isLoading) return <ActivityIndicator />;
  if (withBelts.length === 0) return null;
  const all = belts.data ?? [];

  return (
    <Box gap="s12">
      <Text variant="captionCaps">Suas faixas</Text>
      {withBelts.map((m) => {
        const beltId = profile.belts.find((b) => b.modalityId === m.id)?.beltId;
        const belt = beltsOf(all, m.id).find((b) => b.id === beltId);
        return (
          <Card
            key={m.id}
            flexDirection="row"
            alignItems="center"
            gap="s12"
            onPress={() => setSheet(m.id)}
            accessibilityLabel={`${m.name}: ${belt ? 'alterar faixa' : 'definir faixa'}`}
          >
            <Box flex={1} gap="s8">
              <Text variant="bodyStrong" numberOfLines={1}>
                {m.name}
              </Text>
              {belt ? <BeltChip belt={belt} /> : <Text variant="caption">Sem faixa</Text>}
            </Box>
            <Icon name="chevronRight" color="textMuted" />
          </Card>
        );
      })}
      <InstructorBeltSheet
        visible={sheet !== null}
        academyId={academyId}
        membershipId={profile.membershipId}
        modalities={withBelts}
        belts={all}
        current={profile.belts}
        initialModalityId={sheet}
        onClose={() => setSheet(null)}
      />
    </Box>
  );
}
