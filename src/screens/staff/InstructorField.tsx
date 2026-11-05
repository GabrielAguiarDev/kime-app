import { useState } from 'react';

import { Avatar, BottomSheet, Box, Button, SelectionCard, Text, TextButton } from '@components';
import { useSetSessionInstructor, type ClassSession } from '@domain/Classes';
import { roleLabel, type GymMember } from '@domain/Membership';
import { errorMessage } from '@infra';
import { SheetForm } from '@screens/professor/shared';
import { haptics } from '@utils/haptics';

/** "Professor da aula": the class's instructor, switchable among the academy's staff. */
export function InstructorField({
  academyId,
  session,
  staff,
}: {
  academyId: string;
  session: ClassSession;
  staff: GymMember[];
}) {
  const setInstructor = useSetSessionInstructor(academyId);
  const [open, setOpen] = useState(false);
  const current = staff.find((m) => m.userId === session.instructorId);
  const name = current?.fullName ?? 'Sem professor';

  return (
    <Box gap="s8" paddingTop="s8">
      <Text variant="captionCaps">Professor da aula</Text>
      <Box flexDirection="row" alignItems="center" gap="s12">
        <Avatar name={name} path={current?.avatarPath} />
        <Text variant="bodyStrong" flex={1} numberOfLines={1}>
          {name}
        </Text>
        {staff.length > 1 ? (
          <TextButton
            title="Trocar"
            fullWidth={false}
            disabled={setInstructor.isPending}
            onPress={() => setOpen(true)}
            accessibilityLabel={`Trocar o professor da aula. Atual: ${name}`}
          />
        ) : null}
      </Box>
      {setInstructor.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(setInstructor.error)}
        </Text>
      ) : null}

      <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
        <SheetForm
          title="Professor da aula"
          actions={<Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />}
        >
          {staff.map((member) => (
            <SelectionCard
              key={member.id}
              label={member.fullName}
              description={roleLabel[member.role]}
              leading={<Avatar name={member.fullName} path={member.avatarPath} />}
              selected={member.userId === session.instructorId}
              onPress={() => {
                setOpen(false);
                if (member.userId === session.instructorId) return;
                setInstructor.mutate(
                  { sessionId: session.id, instructorId: member.userId },
                  { onSuccess: () => haptics.success() },
                );
              }}
            />
          ))}
        </SheetForm>
      </BottomSheet>
    </Box>
  );
}
