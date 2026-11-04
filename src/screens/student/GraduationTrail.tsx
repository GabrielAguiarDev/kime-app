import { useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BELT_COLOR_TOKEN, Box, Icon, Mascot, Text } from '@components';
import { beltColorNeedsOutline, beltName, trailNodes, type BeltLook, type TrailNode } from '@domain/Classes';
import { useAppTheme } from '@theme';

interface GraduationTrailProps {
  required: number;
  done: number;
  nextBelt: BeltLook;
}

// Zigzag (Duolingo path): center, right, center, left…
const ZIGZAG = [0, 1, 0, -1] as const;

/**
 * Graduation trail (11.2): vertical zigzag of circular nodes, each a block of
 * classes toward the next belt; the last node is the next belt in its color.
 */
export function GraduationTrail({ required, done, nextBelt }: GraduationTrailProps) {
  const { spacing } = useAppTheme();
  const nodes = trailNodes(required, done);
  const [selected, setSelected] = useState<number | null>(null);
  const shift = spacing.s48;

  return (
    <Box alignItems="center" gap="s24" paddingVertical="s16">
      {nodes.map((node, index) => {
        const offset = (ZIGZAG[index % ZIGZAG.length] ?? 0) * shift;
        const isSelected = selected === index;
        return (
          <Box key={node.from} alignItems="center" gap="s8" style={{ transform: [{ translateX: offset }] }}>
            <Box flexDirection="row" alignItems="center" gap="s12">
              {/* Mascot beside the current node, on the side with room. */}
              {node.state === 'current' && offset > 0 ? <Mascot size="empty" /> : null}
              <TrailNodeButton node={node} onPress={() => setSelected(isSelected ? null : index)} />
              {node.state === 'current' && offset <= 0 ? <Mascot size="empty" /> : null}
            </Box>
            {isSelected ? <NodeCaption text={`Aulas ${node.from}–${node.to} · ${node.doneInNode} de ${node.to - node.from + 1} feitas`} /> : null}
          </Box>
        );
      })}
      <BeltNode belt={nextBelt} required={required} done={done} />
    </Box>
  );
}

function TrailNodeButton({ node, onPress }: { node: TrailNode; onPress: () => void }) {
  const theme = useAppTheme();
  const label = `Aulas ${node.from} a ${node.to}, ${node.doneInNode} de ${node.to - node.from + 1} feitas`;

  if (node.state === 'current') {
    const inner = theme.size.trailNodeCurrent;
    const stroke = theme.size.trailRingStroke;
    // Ring sits around the node with a gap of one stroke.
    const outer = inner + stroke * 4;
    const radius = (outer - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const ratio = node.doneInNode / (node.to - node.from + 1);
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, atual`}>
        <Box width={outer} height={outer} alignItems="center" justifyContent="center">
          {/* TODO(motion): trail ring and belt bar advancing after a confirmed class. */}
          <Svg width={outer} height={outer} style={{ position: 'absolute' }}>
            <Circle cx={outer / 2} cy={outer / 2} r={radius} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
            <Circle
              cx={outer / 2}
              cy={outer / 2}
              r={radius}
              stroke={theme.colors.accent}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circumference * ratio} ${circumference}`}
              transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
            />
          </Svg>
          <Box
            width={inner}
            height={inner}
            backgroundColor="accent"
            borderBottomWidth={theme.border.edgeWidth}
            borderColor="accentEdge"
            alignItems="center"
            justifyContent="center"
            style={{ borderRadius: inner / 2 }}
          >
            <Text variant="counter" color="onAccent">
              {node.doneInNode}/{node.to - node.from + 1}
            </Text>
          </Box>
        </Box>
      </Pressable>
    );
  }

  const size = theme.size.trailNode;
  const done = node.state === 'done';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${done ? ', concluído' : ''}`}>
      <Box
        width={size}
        height={size}
        backgroundColor={done ? 'accent' : 'surface'}
        borderWidth={done ? 0 : theme.border.width}
        borderBottomWidth={theme.border.edgeWidth}
        borderColor={done ? 'accentEdge' : 'border'}
        style={done ? { borderRadius: size / 2 } : { borderRadius: size / 2, borderBottomColor: theme.colors.edge }}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={done ? 'done' : 'locked'} color={done ? 'onAccent' : 'disabled'} active={done} />
      </Box>
    </Pressable>
  );
}

function BeltNode({ belt, required, done }: { belt: BeltLook; required: number; done: number }) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const size = theme.size.trailNode;
  const name = beltName(belt).toLowerCase();
  const outlined = beltColorNeedsOutline(belt.primary) || (!!belt.tip && beltColorNeedsOutline(belt.tip));

  return (
    <Box alignItems="center" gap="s8">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`Próxima faixa: ${beltName(belt)}, ${required} aulas`}
      >
        <Box
          width={size}
          height={size}
          borderWidth={outlined ? theme.border.width : 0}
          borderColor="border"
          borderBottomWidth={theme.border.edgeWidth}
          backgroundColor={BELT_COLOR_TOKEN[belt.primary]}
          flexDirection="row"
          overflow="hidden"
          style={{ borderRadius: size / 2, borderBottomColor: theme.colors.edge }}
        >
          {/* Tip: the last 25% on the right, as on the belt chip. */}
          {belt.tip ? (
            <>
              <Box flex={3} />
              <Box flex={1} backgroundColor={BELT_COLOR_TOKEN[belt.tip]} />
            </>
          ) : null}
        </Box>
      </Pressable>
      <Text variant="caption">{`Faixa ${name}`}</Text>
      {open ? <NodeCaption text={`Faixa ${name} · ${Math.min(done, required)} de ${required} aulas`} /> : null}
    </Box>
  );
}

function NodeCaption({ text }: { text: string }) {
  const { border } = useAppTheme();
  return (
    <Box
      backgroundColor="surface"
      borderWidth={border.width}
      borderColor="border"
      borderRadius="lg"
      paddingHorizontal="s12"
      paddingVertical="s8"
    >
      <Text variant="caption" color="text">
        {text}
      </Text>
    </Box>
  );
}
