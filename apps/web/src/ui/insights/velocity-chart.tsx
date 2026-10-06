import type { Period } from "@nowwhats/insights";
import { formatDay } from "./format.ts";
import { useTooltip } from "./tooltip.tsx";

const W = 640;
const H = 220;
const PAD = { left: 32, right: 12, top: 20, bottom: 28 };

/** 週ごとの完了ポイント（縦棒）。今週の棒だけを濃くして値を表示し、平均を横線で示す */
export const VelocityChart = ({
  weekly,
  average,
}: {
  readonly weekly: readonly Period[];
  readonly average: number;
}) => {
  const tooltip = useTooltip();
  const max = Math.max(5, ...weekly.map((w) => w.points));
  const step = max > 30 ? 10 : 5;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / top);
  const band = (W - PAD.left - PAD.right) / weekly.length;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const last = weekly.length - 1;

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="週ごとの完了ポイント"
        className="block h-auto w-full overflow-visible font-mark text-[11px]"
      >
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-faint"
              strokeWidth={1}
            />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="fill-muted">
              {v}
            </text>
          </g>
        ))}
        {weekly.map((w, i) => {
          const current = i === last;
          const cx = PAD.left + band * i + band / 2;
          const bw = Math.min(24, band * 0.5);
          const x0 = cx - bw / 2;
          const y0 = y(w.points);
          const base = y(0);
          const r = Math.min(4, base - y0);
          return (
            <g key={w.start.getTime()}>
              {w.points > 0 && (
                // 上端だけ角を丸め、基準線側は四角にする
                <path
                  d={`M${x0},${base} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + bw - r} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} V${base} Z`}
                  className={
                    current
                      ? "fill-accent"
                      : "fill-[color-mix(in_srgb,var(--nw-accent)_45%,var(--nw-surface))]"
                  }
                />
              )}
              {current && (
                <text x={cx} y={y0 - 6} textAnchor="middle" className="fill-fg font-semibold">
                  {w.points} pt
                </text>
              )}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                className={current ? "fill-fg font-semibold" : "fill-muted"}
              >
                {current ? "今週" : `${w.start.getMonth() + 1}/${w.start.getDate()}`}
              </text>
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                {...tooltip.bind(`${formatDay(w.start)} の週: ${w.points} pt・${w.count} 件`)}
              />
            </g>
          );
        })}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(average)}
          y2={y(average)}
          className="stroke-muted"
          strokeWidth={1}
        />
        <text x={W - PAD.right} y={y(average) - 5} textAnchor="end" className="fill-muted">
          平均 {average.toFixed(1)}
        </text>
      </svg>
      {tooltip.node}
    </>
  );
};

export const VelocityTable = ({ weekly }: { readonly weekly: readonly Period[] }) => (
  <table className="w-full border-collapse text-sm tabular-nums">
    <thead>
      <tr className="text-left text-muted">
        <th className="border-b border-faint px-2 py-1 font-normal">週</th>
        <th className="border-b border-faint px-2 py-1 font-normal">完了タスク</th>
        <th className="border-b border-faint px-2 py-1 text-right font-normal">完了ポイント</th>
      </tr>
    </thead>
    <tbody>
      {weekly.map((w) => (
        <tr key={w.start.getTime()}>
          <td className="border-b border-faint px-2 py-1">{formatDay(w.start)} 〜</td>
          <td className="border-b border-faint px-2 py-1">{w.count} 件</td>
          <td className="border-b border-faint px-2 py-1 text-right">{w.points} pt</td>
        </tr>
      ))}
    </tbody>
  </table>
);
