import { Box } from '../Box/Box';
import { SelectionCard } from '../SelectionCard/SelectionCard';

interface SelectionGridProps {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  /** Cards per row (default 2). */
  columns?: number;
}

/** Selection cards (11.5) laid out in rows of equal width. */
export function SelectionGrid({ options, selected, onToggle, columns = 2 }: SelectionGridProps) {
  const rows: string[][] = [];
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));
  return (
    <Box gap="s8">
      {rows.map((row, index) => (
        <Box key={index} flexDirection="row" gap="s8">
          {row.map((option) => (
            <SelectionCard
              key={option}
              flex={1}
              label={option}
              selected={selected.includes(option)}
              onPress={() => onToggle(option)}
            />
          ))}
          {/* Keep the last row's cards the same width as the others. */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <Box key={`pad-${i}`} flex={1} />
          ))}
        </Box>
      ))}
    </Box>
  );
}
