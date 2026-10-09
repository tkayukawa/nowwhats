import type { StatusCounts } from "@nowwhats/insights";
import { useState } from "react";
import { formatDay } from "./format.ts";
import { useTooltip } from "./tooltip.tsx";

const W = 640;
const H = 220;
const PAD = { left: 32, right: 12, top: 12, bottom: 28 };

/**
 * 積み上げの順（下から）。色は検証済みのカテゴリ配色の最初の 3 色で、
 * どの組み合わせでも色覚の違いがあっても見分けられる（グラフの指針の palette.md）
 */
export const SERIES = [
  { key: "done", label: "完了", color: "var(--nw-tag-aqua)" },
  { key: "doing", label: "着手中", color: "var(--nw-tag-orange)" },
  { key: "todo", label: "未着手", color: "var(--nw-tag-blue)" },
] as const;

export const StatusLegend = () => (
  <ul className="flex flex-wrap gap-3 text-xs text-muted">
    {[...SERIES].reverse().map((s) => (
      <li key={s.key} className="flex items-center gap-1.5">
        <span
          className="inline-block size-2.5 rounded-sm"
          style={{ background: s.color }}
          aria-hidden="true"
        />
        {s.label}
      </li>
    ))}
  </ul>
);

/** 日ごとの状態別の件数（累積フロー図）。積み上げの帯が太るところに作業が溜まっている */
export const StatusFlowChart = ({ counts }: { readonly counts: readonly StatusCounts[] }) => {
  const tooltip = useTooltip();
  const [hover, setHover] = useState<number | null>(null);
  const total = (c: StatusCounts) => c.todo + c.doing + c.done;
  const max = Math.max(4, ...counts.map(total));
  const step = max > 40 ? 20 : max > 20 ? 10 : max > 8 ? 5 : 2;
  const top = Math.ceil(max / step) * step;
  const n = counts.length;
  const x = (i: number) => PAD.left + ((W - PAD.left - PAD.right) * i) / Math.max(1, n - 1);
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / top);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  // 各系列の下端と上端（下から積み上げる）
  const layers = SERIES.map((s, layer) => {
    const lower = counts.map((c) =>
      SERIES.slice(0, layer).reduce((sum, below) => sum + c[below.key], 0),
    );
    const upper = counts.map((c, i) => (lower[i] ?? 0) + c[s.key]);
    const path = [
      ...upper.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`),
      ...lower.map((v, i) => `L${x(i)},${y(v)}`).reverse(),
      "Z",
    ].join(" ");
    return { ...s, path, upper };
  });
  const band = (W - PAD.left - PAD.right) / Math.max(1, n - 1);

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="日ごとの状態別の件数"
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
        {layers.map((l) => (
          <g key={l.key}>
            <path
              d={l.path}
              style={{ fill: `color-mix(in srgb, ${l.color} 70%, var(--nw-surface))` }}
            />
            {/* 帯の上端の線（2px）。帯の境目を読み取りやすくする */}
            <path
              d={l.upper.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ")}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ stroke: l.color }}
            />
          </g>
        ))}
        {counts.map((c, i) =>
          i === n - 1 || c.date.getDay() === 1 ? (
            <text
              key={c.date.getTime()}
              x={x(i)}
              y={H - 8}
              textAnchor={i === n - 1 ? "end" : "middle"}
              className={i === n - 1 ? "fill-fg font-semibold" : "fill-muted"}
            >
              {i === n - 1 ? "今日" : `${c.date.getMonth() + 1}/${c.date.getDate()}`}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            className="stroke-fg"
            strokeWidth={1}
          />
        )}
        {counts.map((c, i) => (
          <rect
            key={`hit-${c.date.getTime()}`}
            x={x(i) - band / 2}
            y={PAD.top}
            width={band}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            {...(() => {
              const bound = tooltip.bind(
                `${formatDay(c.date)}: 未着手 ${c.todo}・着手中 ${c.doing}・完了 ${c.done}`,
              );
              return {
                onMouseMove: bound.onMouseMove,
                onMouseLeave: () => {
                  bound.onMouseLeave();
                  setHover(null);
                },
              };
            })()}
          />
        ))}
      </svg>
      {tooltip.node}
    </>
  );
};

export const StatusFlowTable = ({ counts }: { readonly counts: readonly StatusCounts[] }) => (
  <div className="max-h-72 overflow-auto">
    <table className="w-full border-collapse text-sm tabular-nums">
      <thead>
        <tr className="text-left text-muted">
          <th className="border-b border-faint px-2 py-1 font-normal">日付</th>
          <th className="border-b border-faint px-2 py-1 text-right font-normal">未着手</th>
          <th className="border-b border-faint px-2 py-1 text-right font-normal">着手中</th>
          <th className="border-b border-faint px-2 py-1 text-right font-normal">完了</th>
        </tr>
      </thead>
      <tbody>
        {[...counts].reverse().map((c) => (
          <tr key={c.date.getTime()}>
            <td className="border-b border-faint px-2 py-1">{formatDay(c.date)}</td>
            <td className="border-b border-faint px-2 py-1 text-right">{c.todo}</td>
            <td className="border-b border-faint px-2 py-1 text-right">{c.doing}</td>
            <td className="border-b border-faint px-2 py-1 text-right">{c.done}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
