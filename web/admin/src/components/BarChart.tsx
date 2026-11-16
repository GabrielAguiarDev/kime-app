import { useLayoutEffect, useRef, useState } from 'react';

export interface Series {
  name: string;
  /** CSS color (a --chart-* variable). */
  color: string;
}

interface Props {
  /** One group per x label; values[i] belongs to series[i]. */
  data: { label: string; values: number[] }[];
  series: Series[];
  format: (v: number) => string;
  /** Short tick format (axis). */
  formatTick?: (v: number) => string;
  /** Smallest axis step (1 for counts, 100 for cents) so ticks never repeat. */
  minStep?: number;
  height?: number;
  label: string;
}

const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

/** Clean ticks: 0 and 3–4 round steps up to the max. */
function ticks(max: number, minStep: number): number[] {
  if (max <= 0) return [0, minStep];
  const raw = Math.max(max / 4, minStep);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v < max + step; v += step) out.push(v);
  return out;
}

/** Grouped column chart (one or two series), with a hover tooltip per group. */
export function BarChart({ data, series, format, formatTick = format, minStep = 1, height = 240, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...data.flatMap(d => d.values));
  const yTicks = ticks(max, minStep);
  const top = yTicks[yTicks.length - 1] || 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const gap = 2;
  const barW = Math.min(24, Math.max(4, (band * 0.7 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const everyNth = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));

  // Column with a 4px rounded top, square at the baseline.
  const bar = (x: number, v: number) => {
    const h = Math.max(0, PAD.top + plotH - y(v));
    if (h === 0) return '';
    const r = Math.min(4, h, barW / 2);
    const yb = PAD.top + plotH;
    const yt = yb - h;
    return `M${x},${yb}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + barW - r}Q${x + barW},${yt} ${x + barW},${yt + r}V${yb}Z`;
  };

  const hovered = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? PAD.left + band * hover + band / 2 : 0;

  return (
    <figure className="chart" aria-label={label}>
      {series.length > 1 && (
        <figcaption className="legend">
          {series.map(s => (
            <span key={s.name}>
              <i style={{ background: s.color }} aria-hidden="true" />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div className="chart-plot" ref={wrap} onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={label}>
          {yTicks.map(t => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatTick(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = PAD.left + band * i + (band - groupW) / 2;
            return (
              <g key={d.label}>
                {hover === i && <rect className="hover-band" x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} />}
                {d.values.map((v, j) => (
                  <path key={j} d={bar(x0 + j * (barW + gap), v)} fill={series[j].color} />
                ))}
                {i % everyNth === 0 && (
                  <text className="tick" x={PAD.left + band * i + band / 2} y={height - 8} textAnchor="middle">
                    {d.label}
                  </text>
                )}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="tooltip"
            style={{ left: Math.min(Math.max(tipLeft, 90), width - 90), top: PAD.top }}
            role="status"
          >
            <strong>{hovered.label}</strong>
            {series.map((s, j) => (
              <span key={s.name}>
                <i style={{ background: s.color }} aria-hidden="true" />
                {s.name}: {format(hovered.values[j])}
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
