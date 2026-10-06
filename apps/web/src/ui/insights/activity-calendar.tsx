import type { Period } from "@nowwhats/insights";
import { formatDay } from "./format.ts";
import { useTooltip } from "./tooltip.tsx";

const CELL = 13;
const GAP = 3;
const LEFT = 22;
const TOP = 16;
const ROW_LABELS = ["月", "", "水", "", "金", "", "日"];

/** 日ごとの完了ポイントを 5 段階の濃淡にする */
const level = (points: number): number =>
  points === 0 ? 0 : points <= 2 ? 1 : points <= 5 ? 2 : points <= 8 ? 3 : 4;

/** 日ごとの完了ポイント（列 = 週、行 = 曜日）。daily は月曜から始まる前提 */
export const ActivityCalendar = ({ daily }: { readonly daily: readonly Period[] }) => {
  const tooltip = useTooltip();
  const columns = Math.ceil(daily.length / 7);
  const pitch = CELL + GAP;

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <svg
          width={LEFT + columns * pitch}
          height={TOP + 7 * pitch}
          role="img"
          aria-label="日ごとの完了ポイント"
          className="block font-mark text-[10px]"
        >
          {ROW_LABELS.map((label, r) =>
            label === "" ? null : (
              <text key={r} x={0} y={TOP + r * pitch + CELL - 2} className="fill-muted">
                {label}
              </text>
            ),
          )}
          {daily.map((d, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            return (
              <g key={d.start.getTime()}>
                {row === 0 && d.start.getDate() <= 7 && (
                  <text x={LEFT + col * pitch} y={10} className="fill-muted">
                    {d.start.getMonth() + 1}月
                  </text>
                )}
                <rect
                  x={LEFT + col * pitch}
                  y={TOP + row * pitch}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  style={{ fill: `var(--nw-seq-${level(d.points)})` }}
                  {...tooltip.bind(`${formatDay(d.start)}: ${d.points} pt・${d.count} 件`)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted" aria-hidden="true">
        少ない
        {[0, 1, 2, 3, 4].map((l) => (
          <i
            key={l}
            className="inline-block size-[11px] rounded-[3px]"
            style={{ background: `var(--nw-seq-${l})` }}
          />
        ))}
        多い
      </div>
      {tooltip.node}
    </div>
  );
};
