import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Switch } from 'react-native';

import {
  BELT_COLOR_TOKEN,
  BELT_PICKER_COLORS,
  BeltSwatch,
  BottomSheet,
  Box,
  Button,
  Card,
  ChoiceRow,
  EmptyState,
  Icon,
  Screen,
  Text,
  TextField,
  type IconName,
} from '@components';
import {
  BELT_COLOR_LABEL,
  beltColorIsLight,
  beltName,
  beltsOf,
  sameBeltLook,
  useBeltMutations,
  useBelts,
  useModalities,
  type BeltColorKey,
  type Modality,
  type ModalityBelt,
} from '@domain/Classes';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { SheetForm } from './shared';

const MAX_CLASSES = 10000;

type Editing = { mode: 'new' } | { mode: 'edit'; belt: ModalityBelt };

/**
 * Owner: the belt sequence of each modality with belts (route param
 * `modalidade`), in order: name, color and the confirmed classes in that
 * modality each belt requires.
 */
export function BeltGoalsScreen() {
  const { modalidade } = useLocalSearchParams<{ modalidade?: string }>();
  const { active } = useActiveGym();
  const modalities = useModalities(active?.gymId);
  const belts = useBelts(active?.gymId);
  const [pickedId, setPickedId] = useState<string | null>(modalidade ?? null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!active) return null;

  const withBelts = (modalities.data ?? []).filter((m) => m.usesBelts);
  const modality = withBelts.find((m) => m.id === pickedId) ?? withBelts[0] ?? null;
  const list = modality ? beltsOf(belts.data ?? [], modality.id) : [];
  const loading = modalities.isLoading || belts.isLoading;
  const failed = modalities.isError || belts.isError;
  const open = (next: Editing) => {
    setEditing(next);
    setSheetOpen(true);
  };

  return (
    <Screen nativeHeader
      title="Faixas"
      onBack={() => router.back()}
      topAction={
        modality && list.length > 1
          ? {
              icon: 'reorder',
              accessibilityLabel: 'Ordenar faixas',
              onPress: () => router.push({ pathname: '/academy/belts-order', params: { modalidade: modality.id } }),
            }
          : undefined
      }
      footer={modality ? <Button title="Adicionar faixa" icon="plus" onPress={() => open({ mode: 'new' })} /> : undefined}
    >
      {loading ? <ActivityIndicator /> : null}
      {failed ? (
        <EmptyState
          visual="icon"
          icon="offline"
          title="Não foi possível carregar as faixas"
          action={
            <Button
              title="Tentar de novo"
              variant="secondary"
              onPress={() => {
                modalities.refetch();
                belts.refetch();
              }}
            />
          }
        />
      ) : null}
      {!loading && !failed && !modality ? (
        <EmptyState
          title="Nenhuma modalidade com faixas."
          description="Em Configurações da academia, marque que a modalidade usa faixas."
        />
      ) : null}
      {modality ? (
        <Box gap="s16">
          {!modalidade && withBelts.length > 1 ? (
            <ChoiceRow
              accessibilityLabel="Modalidade"
              options={withBelts.map((m) => ({ value: m.id, label: m.name }))}
              value={modality.id}
              onChange={setPickedId}
            />
          ) : (
            <Text variant="captionCaps">{modality.name}</Text>
          )}
          <Text variant="body" color="textMuted">
            {`Aulas confirmadas de ${modality.name} necessárias para cada faixa, contadas desde a última graduação do aluno nessa modalidade.`}
          </Text>
          {belts.data && list.length === 0 ? (
            <EmptyState
              visual="icon"
              icon="belt"
              title="Nenhuma faixa cadastrada."
              description="Adicione as faixas na ordem da graduação."
            />
          ) : null}
          <Box gap="s12">
            {list.map((belt, index) => (
              <BeltRow
                key={belt.id}
                belt={belt}
                index={index}
                academyId={active.gymId}
                modalityId={modality.id}
                onEdit={() => open({ mode: 'edit', belt })}
              />
            ))}
          </Box>
        </Box>
      ) : null}

      <BottomSheet visible={sheetOpen} onRequestClose={() => setSheetOpen(false)} onClosed={() => setEditing(null)}>
        {editing && modality ? (
          <BeltForm
            key={editing.mode === 'edit' ? editing.belt.id : `new-${modality.id}`}
            academyId={active.gymId}
            modality={modality}
            editing={editing}
            existing={list}
            onDone={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/** Compact row: belt (with tip), name, classes, and edit / delete icons. Order lives in "Ordenar faixas". */
function BeltRow({
  belt,
  index,
  academyId,
  modalityId,
  onEdit,
}: {
  belt: ModalityBelt;
  index: number;
  academyId: string;
  modalityId: string;
  onEdit: () => void;
}) {
  const { remove } = useBeltMutations(academyId, modalityId);
  const confirm = useConfirm();
  const name = beltName(belt);

  const confirmRemove = async () => {
    const ok = await confirm({
      title: `Remover faixa ${name.toLowerCase()}?`,
      message: 'Ela sai da trilha de graduação. Uma faixa que já foi entregue a algum aluno não pode ser removida.',
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) remove.mutate(belt.id);
  };

  return (
    <Box gap="s4">
      <Card flexDirection="row" alignItems="center" gap="s12" paddingVertical="s8">
        <BeltSwatch belt={belt} />
        <Box flex={1}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          {belt.classesRequired ? (
            <Text variant="caption">
              {index === 0 ? `${belt.classesRequired} aulas sem faixa` : `${belt.classesRequired} aulas na faixa anterior`}
            </Text>
          ) : (
            <Text variant="caption" color="warning">
              Defina as aulas necessárias
            </Text>
          )}
        </Box>
        <IconButton icon="edit" label={`Editar faixa ${name}`} disabled={remove.isPending} onPress={onEdit} />
        <IconButton
          icon="trash"
          label={`Remover faixa ${name}`}
          color="danger"
          disabled={remove.isPending}
          onPress={confirmRemove}
        />
      </Card>
      {remove.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(remove.error)}
        </Text>
      ) : null}
    </Box>
  );
}

/** Icon-only control with a 44×44 touch area (section 10). */
function IconButton({
  icon,
  label,
  disabled,
  onPress,
  color = 'accent',
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
  color?: 'accent' | 'danger';
}) {
  const { size } = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ width: size.touchTarget, height: size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} color={disabled ? 'disabled' : color} />
    </Pressable>
  );
}

function BeltForm({
  academyId,
  modality,
  editing,
  existing,
  onDone,
}: {
  academyId: string;
  modality: Modality;
  editing: Editing;
  existing: ModalityBelt[];
  onDone: () => void;
}) {
  const { colors } = useAppTheme();
  const initial = editing.mode === 'edit' ? editing.belt : null;
  const { create, update } = useBeltMutations(academyId, modality.id);
  const [primary, setPrimary] = useState<BeltColorKey | null>(initial?.primary ?? null);
  const [withTip, setWithTip] = useState(!!initial?.tip);
  const [tip, setTip] = useState<BeltColorKey | null>(initial?.tip ?? null);
  // Which part the color grid paints (only matters with a tip).
  const [target, setTarget] = useState<'primary' | 'tip'>('primary');
  const [classes, setClasses] = useState(initial?.classesRequired ? String(initial.classesRequired) : '');

  // Every belt needs its number of classes; the first one counts from "no belt".
  const ordered = [...existing].sort((a, b) => a.position - b.position);
  const isFirst = initial ? ordered[0]?.id === initial.id : ordered.length === 0;
  const look = primary ? { primary, tip: withTip && tip && tip !== primary ? tip : null } : null;
  const tipMissing = withTip && !look?.tip;
  const duplicate = !!look && existing.some((b) => b.id !== initial?.id && sameBeltLook(b, look));
  const count = Number(classes);
  const countOk = Number.isInteger(count) && count > 0 && count <= MAX_CLASSES;
  const valid = !!look && !tipMissing && !duplicate && countOk;
  const mutation = initial ? update : create;

  const submit = () => {
    if (!valid || !look) return;
    const input = { ...look, classesRequired: count };
    const options = {
      onSuccess: () => {
        haptics.success();
        onDone();
      },
    };
    if (initial) update.mutate({ id: initial.id, input }, options);
    else {
      const position = existing.length === 0 ? 0 : Math.max(...existing.map((b) => b.position)) + 1;
      create.mutate({ input, position }, options);
    }
  };

  return (
    <SheetForm
      tall
      title={initial ? 'Editar faixa' : `Nova faixa · ${modality.name}`}
      actions={<Button title="Salvar" disabled={!valid} loading={mutation.isPending} onPress={submit} />}
    >
      <BeltPreview look={look} />

      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s12">
        <Text variant="bodyStrong" flex={1}>
          Adicionar ponta
        </Text>
        <Switch
          value={withTip}
          onValueChange={(on) => {
            setWithTip(on);
            setTarget(on ? 'tip' : 'primary');
          }}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.border}
          accessibilityLabel="Adicionar ponta"
        />
      </Box>

      {/* With a tip: pick which part the grid paints. */}
      {withTip ? (
        <Box flexDirection="row" gap="s12">
          <PartTarget
            label="Faixa"
            color={primary}
            selected={target === 'primary'}
            onPress={() => setTarget('primary')}
          />
          <PartTarget label="Ponta" color={tip} selected={target === 'tip'} onPress={() => setTarget('tip')} />
        </Box>
      ) : null}

      <Box gap="s8">
        <Text variant="caption">{withTip && target === 'tip' ? 'Cor da ponta' : 'Cor da faixa'}</Text>
        <ColorGrid
          value={withTip && target === 'tip' ? tip : primary}
          exclude={withTip && target === 'tip' ? primary : null}
          onChange={(key) => {
            if (withTip && target === 'tip') {
              setTip(key);
              return;
            }
            setPrimary(key);
            if (tip === key) setTip(null);
          }}
          accessibilityLabel={withTip && target === 'tip' ? 'Cor da ponta' : 'Cor da faixa'}
        />
      </Box>

      {duplicate ? (
        <Text variant="caption" color="danger">
          Esta modalidade já tem essa faixa.
        </Text>
      ) : null}

      <TextField
        label="Aulas necessárias"
        value={classes}
        onChangeText={(t) => setClasses(t.replace(/\D/g, '').slice(0, 5))}
        keyboardType="number-pad"
        unit="aulas"
        placeholder={isFirst ? '10' : '120'}
        errorMessage={
          classes && !countOk
            ? `Use um número entre 1 e ${MAX_CLASSES}.`
            : mutation.error
              ? errorMessage(mutation.error)
              : undefined
        }
      />
      <Text variant="caption">
        {isFirst
          ? 'Aulas do aluno sem faixa para receber esta, a primeira da sequência.'
          : 'Aulas na faixa anterior para receber esta.'}
      </Text>
    </SheetForm>
  );
}

/** Big preview of the belt being built: main color, last 25% in the tip color, generated name below. */
function BeltPreview({ look }: { look: { primary: BeltColorKey; tip: BeltColorKey | null } | null }) {
  const { size } = useAppTheme();
  return (
    <Box alignItems="center" gap="s8" paddingVertical="s8">
      <BeltSwatch belt={look} fill height={size.beltPreviewHeight} />
      <Text variant="heading" color={look ? 'text' : 'textMuted'}>
        {look ? beltName(look) : 'Escolha a cor'}
      </Text>
    </Box>
  );
}

/** One part of the belt (main color or tip) as a selectable box: its color + label. */
function PartTarget({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: BeltColorKey | null;
  selected: boolean;
  onPress: () => void;
}) {
  const { size, border } = useAppTheme();
  return (
    <Box flex={1}>
      <Pressable
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}: ${color ? BELT_COLOR_LABEL[color] : 'sem cor'}`}
      >
        <Box
          flexDirection="row"
          alignItems="center"
          gap="s12"
          padding="s12"
          borderRadius="md"
          borderWidth={border.width}
          borderColor={selected ? 'accent' : 'border'}
          backgroundColor={selected ? 'accentSelected' : 'surface'}
        >
          <Box
            width={size.icon}
            height={size.icon}
            borderRadius="sm"
            borderWidth={!color || color === 'white' || color === 'black' ? border.width : 0}
            borderColor="border"
            backgroundColor={color ? BELT_COLOR_TOKEN[color] : 'surfaceRaised'}
          />
          <Box flex={1}>
            <Text variant="caption">{label}</Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {color ? BELT_COLOR_LABEL[color] : 'Escolha'}
            </Text>
          </Box>
        </Box>
      </Pressable>
    </Box>
  );
}

/**
 * All belt colors (2.4 + variações) in one grid of 44pt squares (minimum
 * touch target), wrapping as many per row as fit, grouped by family.
 */
function ColorGrid({
  value,
  onChange,
  exclude,
  accessibilityLabel,
}: {
  value: BeltColorKey | null;
  onChange: (key: BeltColorKey) => void;
  exclude?: BeltColorKey | null;
  accessibilityLabel: string;
}) {
  const { size, border } = useAppTheme();
  const options = BELT_PICKER_COLORS.filter((c) => c.key !== exclude);

  return (
    <Box
      flexDirection="row"
      flexWrap="wrap"
      gap="s8"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
    >
      {options.map((c) => {
        const selected = value === c.key;
        const outlined = c.key === 'white' || c.key === 'black';
        return (
          <Pressable
            key={c.key}
            onPress={() => {
              haptics.tap();
              onChange(c.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={c.label}
          >
            <Box
              width={size.beltColorSwatch}
              height={size.beltColorSwatch}
              borderRadius="sm"
              backgroundColor={BELT_COLOR_TOKEN[c.key]}
              borderWidth={selected || outlined ? border.width : 0}
              borderColor={selected ? 'accent' : 'border'}
              alignItems="center"
              justifyContent="center"
            >
              {selected ? <Icon name="done" active color={beltColorIsLight(c.key) ? 'onWarning' : 'onAccent'} /> : null}
            </Box>
          </Pressable>
        );
      })}
    </Box>
  );
}
