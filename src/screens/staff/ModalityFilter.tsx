import { useState } from 'react';

import { BottomSheet, FilterChips, SelectionCard, type FilterChip } from '@components';
import type { Modality } from '@domain/Classes';
import { SheetForm } from '@screens/professor/shared';

/**
 * The staff modality filter (user decision: one compact chip that opens a
 * sheet; never a row of chips scrolling sideways). With `allowAll`, the sheet
 * starts with "Todas as modalidades" (value null). Extra chips go after it.
 * Hidden when the academy has a single modality and nothing else to show.
 */
export function ModalityFilter({
  modalities,
  value,
  onChange,
  allowAll = true,
  extraChips = [],
}: {
  modalities: Modality[];
  value: string | null;
  onChange: (modalityId: string | null) => void;
  allowAll?: boolean;
  extraChips?: FilterChip[];
}) {
  const [picking, setPicking] = useState(false);
  const selected = modalities.find((m) => m.id === value) ?? null;
  const allLabel = 'Todas as modalidades';
  const showModality = modalities.length > 1;
  if (!showModality && extraChips.length === 0) return null;

  const options: { id: string | null; name: string }[] = [
    ...(allowAll ? [{ id: null, name: allLabel }] : []),
    ...modalities,
  ];

  return (
    <>
      <FilterChips
        accessibilityLabel="Filtros"
        chips={[
          ...(showModality
            ? [
                {
                  key: 'modality',
                  label: selected?.name ?? allLabel,
                  selected: allowAll ? !!selected : true,
                  icon: 'chevronDown' as const,
                  accessibilityLabel: `Modalidade: ${selected?.name ?? 'todas'}. Trocar`,
                  onPress: () => setPicking(true),
                },
              ]
            : []),
          ...extraChips,
        ]}
      />
      <BottomSheet visible={picking} onRequestClose={() => setPicking(false)}>
        <SheetForm title="Modalidade" tall>
          {options.map((m) => (
            <SelectionCard
              key={m.id ?? 'all'}
              label={m.name}
              selected={value === m.id}
              onPress={() => {
                onChange(m.id);
                setPicking(false);
              }}
            />
          ))}
        </SheetForm>
      </BottomSheet>
    </>
  );
}
