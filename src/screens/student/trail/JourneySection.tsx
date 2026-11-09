import { memo, useRef, type ComponentRef } from 'react';
import { View } from 'react-native';

import { BeltSwatch, Box, Mascot, Text } from '@components';
import type { TrailSection } from '@domain/Classes';
import { useAppTheme, withAlpha } from '@theme';

import { MASCOT, MASCOT_GAP, NODE_OVER_BANNER, NODE_Y, SECTION_HEIGHT, bannerWidth as bannerWidthOf } from './journeyLayout';
import { JourneyNode, NODE_GLOW, NODE_SIZE, NODE_SIZE_CURRENT, type JourneyNodeState } from './JourneyNode';
import { isReady, nodeCopy, sectionCount, sectionTitle } from './trailCopy';

/** Text grows up to 130% (DESIGN-SYSTEM.md 10) inside the banner. */
const FONT_SCALE = 1.3;

export interface NodePress {
  section: number;
  view: ComponentRef<typeof View>;
}

interface JourneySectionProps {
  section: TrailSection;
  index: number;
  /** Top of the section in the content (points). */
  top: number;
  width: number;
  modalityTotal: number;
  onNodePress: (press: NodePress) => void;
}

/** Where the node of a section sits inside its section (center, in points): on the path, at the screen center. */
export function nodeCenter(width: number) {
  return { x: width / 2, y: NODE_Y };
}

/**
 * The layer of one section drawn OVER all the scenery (so the hill line of
 * the section below never covers its banner): the node on the path, the
 * banner right under it, the mascot to the right of the current node.
 */
export const JourneySection = memo(function JourneySection({ section, index, top, width, modalityTotal, onNodePress }: JourneySectionProps) {
  const { border, spacing, colors, opacity } = useAppTheme();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const center = nodeCenter(width);
  const state: JourneyNodeState = section.state === 'done' ? 'done' : section.state === 'current' ? 'current' : 'locked';
  const size = state === 'current' ? NODE_SIZE_CURRENT : NODE_SIZE;
  const bannerWidth = bannerWidthOf(width, spacing.screenMargin);
  const bannerLeft = Math.max(spacing.screenMargin, Math.min(center.x - bannerWidth / 2, width - spacing.screenMargin - bannerWidth));
  const copy = nodeCopy(section, index, modalityTotal);
  const title = sectionTitle(section, index);
  const count = sectionCount(section, modalityTotal);
  const chip = section.belt ?? section.next;
  const progress = section.isFinal ? 1 : section.required > 0 ? section.done / section.required : 0;

  return (
    <View style={{ position: 'absolute', top, left: 0, width, height: SECTION_HEIGHT }} pointerEvents="box-none">

      {state === 'current' ? (
        // TODO(motion): glow behind the current node pulsing softly. Under the banner.
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: center.x - (size + NODE_GLOW) / 2,
            top: center.y - (size + NODE_GLOW) / 2,
            width: size + NODE_GLOW,
            height: size + NODE_GLOW,
            borderRadius: (size + NODE_GLOW) / 2,
            backgroundColor: withAlpha(colors.accent, opacity.feedback),
          }}
        />
      ) : null}

      <Box
        position="absolute"
        flexDirection="row"
        alignItems="center"
        gap="s12"
        backgroundColor="surface"
        borderColor="border"
        borderWidth={border.width}
        borderRadius="lg"
        paddingHorizontal="s16"
        paddingVertical="s12"
        style={{ left: bannerLeft, width: bannerWidth, top: center.y + size / 2 - NODE_OVER_BANNER }}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${title}. ${count}`}
      >
        <Box flex={1} gap="s4">
          {/* Long belt names ("Faixa branca/ponta vermelha") shrink a little before truncating. */}
          <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={FONT_SCALE}>
            {title}
          </Text>
          <Text variant="caption" numberOfLines={1} maxFontSizeMultiplier={FONT_SCALE} color={isReady(section) ? 'accent' : 'textMuted'}>
            {isReady(section) ? `${count} · pronto para graduar` : count}
          </Text>
        </Box>
        {chip ? <BeltSwatch belt={chip} width={36} height={12} /> : null}
      </Box>

      <View style={{ position: 'absolute', left: center.x - size / 2, top: center.y - size / 2 }}>
        <JourneyNode
          ref={ref}
          state={state}
          progress={progress}
          belt={section.belt ?? section.next}
          onPress={() => {
            if (ref.current) onNodePress({ section: index, view: ref.current });
          }}
          accessibilityLabel={`${copy.title}. ${copy.status}`}
        />
      </View>

      {state === 'current' ? (
        // TODO(motion): mascot idle / reacting next to the current node.
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: center.x + size / 2 + MASCOT_GAP, top: center.y - MASCOT / 2 }}
        >
          <Mascot size="empty" expression="angry" />
        </View>
      ) : null}
    </View>
  );
});
