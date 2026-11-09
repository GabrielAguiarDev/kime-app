import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import type { GraduationTrail } from '@domain/Classes';
import { useAppTheme } from '@theme';

import { SECTION_HEIGHT, START_HEIGHT, TOP_HEIGHT } from './journeyLayout';
import { SectionScenery, StartScenery, TopScenery } from './JourneyScenery';
import { JourneySection, nodeCenter, type NodePress } from './JourneySection';
import { JOURNEY_OVERSCROLL } from './journeyTheme';
import { nodeCopy, type NodeCopy } from './trailCopy';
import { TrailPopover, type PopoverAnchor } from './TrailPopover';

interface GraduationTrailListProps {
  /** Loading / empty states, shown instead of the trail (with the screen margins). */
  header?: ReactNode;
  /** Null while loading or when the modality has no belts: only the header. */
  trail: GraduationTrail | null;
  /** Confirmed classes in the modality ("Faixa máxima"). */
  modalityTotal: number;
  /** Scrolls to the current section whenever this changes (opening, modality, demo). */
  scrollKey: string;
}

/** After the scroll to the current section the ninja sits a little below the middle. */
const CURRENT_AT = 0.55;
/** Waits for the layout to settle before scrolling. */
const SCROLL_DELAY_MS = 120;

/**
 * The Jornada: the trail CLIMBS (user decision — never flip it). From the
 * bottom up: the start (meadow, signpost), one vector scenery per section
 * (Seção 1 at the bottom), the top (sky, dojo) — see journeyLayout. Rows are
 * the sections in reverse order (row j = section n-1-j). Each block's hill
 * line rises over the block above, so the nodes, banners and mascot are a
 * separate layer over all the scenery. A plain ScrollView: a trail has one
 * section per belt (a handful), and the layer needs every section mounted.
 *
 * Full screen: no automatic insets (the top starts at the screen top, behind
 * the transparent header and status bar; the path starts at the bottom edge
 * of the content, over the home indicator). The iOS bounce is on: behind the
 * transparent scroll view the upper half is sky and the lower half meadow, so
 * pulling past the ends only shows more sky or more ground. A trail shorter
 * than the screen grows the top (more sky).
 */
export function GraduationTrailList({ header, trail, modalityTotal, scrollKey }: GraduationTrailListProps) {
  const { width } = useWindowDimensions();
  const { colors, spacing } = useAppTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const [viewport, setViewport] = useState(0);
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [popover, setPopover] = useState<{ anchor: PopoverAnchor; copy: NodeCopy; trail: GraduationTrail } | null>(null);

  const sections = useMemo(() => trail?.sections ?? [], [trail]);
  const rows = useMemo(() => [...sections].reverse(), [sections]);
  const rowOf = useCallback((sectionIndex: number) => sections.length - 1 - sectionIndex, [sections.length]);
  const sectionsHeight = rows.length * SECTION_HEIGHT;
  // The top grows (more sky) so a short trail still fills the screen.
  const topHeight = Math.max(TOP_HEIGHT, viewport - sectionsHeight - START_HEIGHT);
  const contentHeight = topHeight + sectionsHeight + START_HEIGHT;

  // ------------------------------------------- scroll to current section ---
  const scrolledKey = useRef<string | null>(null);
  useEffect(() => {
    if (!trail || sections.length === 0 || !viewport || scrolledKey.current === scrollKey) return;
    const timer = setTimeout(() => {
      scrolledKey.current = scrollKey;
      const y = topHeight + rowOf(trail.currentSection) * SECTION_HEIGHT + nodeCenter(width).y;
      // Never past the bottom of the content.
      const target = Math.max(0, Math.min(y - viewport * CURRENT_AT, contentHeight - viewport));
      scrollRef.current?.scrollTo({ y: target, animated: false });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trail, sections.length, rowOf, width, scrollKey, topHeight, viewport, contentHeight]);

  // ------------------------------------------------------------- popover ---
  const onNodePress = useCallback(
    ({ section, view }: NodePress) => {
      const box = containerRef.current;
      const data = sections[section];
      if (!box || !data || !trail) return;
      view.measureInWindow((x, y, w, h) => {
        box.measureInWindow((cx, cy) => {
          setPopover({ anchor: { x: x - cx, y: y - cy, width: w, height: h }, copy: nodeCopy(data, section, modalityTotal), trail });
        });
      });
    },
    [sections, modalityTotal, trail],
  );

  return (
    <View
      ref={containerRef}
      collapsable={false}
      style={{ flex: 1, backgroundColor: trail ? undefined : colors.bg }}
      onLayout={(e) => setContainer({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {trail ? (
        // Overscroll: more sky above, more meadow below (behind the transparent scroll view).
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} pointerEvents="none">
          <View style={{ flex: 1, backgroundColor: JOURNEY_OVERSCROLL.top }} />
          <View style={{ flex: 1, backgroundColor: JOURNEY_OVERSCROLL.bottom }} />
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        contentInsetAdjustmentBehavior={trail ? 'never' : 'automatic'}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: trail ? 'transparent' : colors.bg }}
      >
        {trail ? (
          <View style={{ width, height: contentHeight }}>
            <TopScenery width={width} height={topHeight} />
            {/* Later blocks draw over earlier ones: each hill line rises over the block above. */}
            {rows.map((s, row) => (
              <View key={s.key} style={{ width, height: SECTION_HEIGHT }}>
                <SectionScenery
                  width={width}
                  environment={s.environment}
                  sectionIndex={rowOf(row)}
                  sectionCount={rows.length}
                  sectionKey={s.key}
                  current={s.state === 'current'}
                />
              </View>
            ))}
            <View style={{ width, height: START_HEIGHT }}>
              <StartScenery width={width} />
            </View>
            {/* Nodes, banners and mascot over all the scenery. */}
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} pointerEvents="box-none">
              {rows.map((s, row) => (
                <JourneySection
                  key={s.key}
                  section={s}
                  index={rowOf(row)}
                  top={topHeight + row * SECTION_HEIGHT}
                  width={width}
                  modalityTotal={modalityTotal}
                  onNodePress={onNodePress}
                />
              ))}
            </View>
          </View>
        ) : header ? (
          <View style={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.s24 }}>{header}</View>
        ) : null}
      </ScrollView>
      {/* A popover opened on another trail (modality / data / demo changed) is dropped. */}
      {popover && popover.trail === trail ? (
        <TrailPopover anchor={popover.anchor} container={container} copy={popover.copy} onClose={() => setPopover(null)} />
      ) : null}
    </View>
  );
}
