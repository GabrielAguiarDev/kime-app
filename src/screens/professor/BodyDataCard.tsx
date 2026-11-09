import { Box, Card, Text } from '@components';
import { formatBodyNumber, useBodyData } from '@domain/Profile';

/**
 * Staff, student page: weight, height and reach side by side. The data is
 * readable only while the student competes (get_profile_details); nothing
 * renders otherwise or when none was filled in.
 */
export function BodyDataCard({ userId }: { userId: string }) {
  const body = useBodyData(userId);
  const data = body.data;
  if (!data || (data.weightKg === null && data.heightCm === null && data.reachCm === null)) return null;
  const stats: [string, number | null, string][] = [
    ['Peso', data.weightKg, 'kg'],
    ['Altura', data.heightCm, 'cm'],
    ['Alcance', data.reachCm, 'cm'],
  ];
  return (
    <Card flexDirection="row" gap="s12">
      {stats.map(([label, value, unit]) => (
        <Box
          key={label}
          flex={1}
          alignItems="center"
          gap="s4"
          accessible
          accessibilityLabel={`${label}: ${value === null ? 'não informado' : `${formatBodyNumber(value)} ${unit}`}`}
        >
          <Text variant="heading">{value === null ? '—' : `${formatBodyNumber(value)} ${unit}`}</Text>
          <Text variant="caption">{label}</Text>
        </Box>
      ))}
    </Card>
  );
}
