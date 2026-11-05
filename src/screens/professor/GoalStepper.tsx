import { Pressable } from 'react-native';

import { Box, Icon, Text, type IconName } from '@components';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 14;

export function weeklyGoalLabel(n: number): string {
  return `${n} ${n === 1 ? 'aula' : 'aulas'} por semana`;
}

/** Weekly class goal stepper (no keyboard): 1 to 14 classes per week. */
export function GoalStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { size } = useAppTheme();
  const less = value > WEEKLY_GOAL_MIN;
  const more = value < WEEKLY_GOAL_MAX;
  return (
    <Box flexDirection="row" alignItems="center" gap="s12">
      <Text variant="bodyStrong" flex={1}>
        Aulas por semana
      </Text>
      <StepButton icon="minus" label="Menos uma aula" disabled={!less} onPress={() => less && onChange(value - 1)} />
      <Box
        width={size.button}
        alignItems="center"
        accessible
        accessibilityLabel={`Meta: ${weeklyGoalLabel(value)}`}
        accessibilityLiveRegion="polite"
      >
        <Text variant="displayLg" numberOfLines={1}>
          {value}
        </Text>
      </Box>
      <StepButton icon="plus" label="Mais uma aula" disabled={!more} onPress={() => more && onChange(value + 1)} />
    </Box>
  );
}

/** Square secondary tactile button (3.1, secondary) holding only − or +. */
function StepButton({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  const { size, border } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
    >
      {({ pressed }) => {
        // TODO(motion): step button sinking on press and rising back.
        const edge = disabled || pressed ? 0 : border.edgeWidth;
        return (
          <Box style={{ paddingTop: border.edgeWidth - edge }}>
            <Box backgroundColor={edge > 0 ? 'edge' : 'transparent'} borderRadius="md" style={{ paddingBottom: edge }}>
              <Box
                width={size.button}
                height={size.button}
                borderRadius="md"
                borderWidth={border.width}
                borderColor={disabled ? 'disabled' : 'border'}
                backgroundColor={disabled ? 'disabled' : 'surface'}
                alignItems="center"
                justifyContent="center"
              >
                <Icon name={icon} color={disabled ? 'textMuted' : 'text'} />
              </Box>
            </Box>
          </Box>
        );
      }}
    </Pressable>
  );
}
