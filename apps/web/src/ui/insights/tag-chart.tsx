import type { TagTotal } from "@nowwhats/insights";
import type { TagDto } from "@nowwhats/task-management";
import { tagColorVar } from "../tags.tsx";
import { useTooltip } from "./tooltip.tsx";

export type TagMetric = "points" | "count";

/** タグ別の完了量（横棒）。量の比較なので棒は 1 色にし、どのタグかは色の点と名前で示す */
export const TagChart = ({
  totals,
  tags,
  metric,
}: {
  readonly totals: readonly TagTotal[];
  readonly tags: readonly TagDto[];
  readonly metric: TagMetric;
}) => {
  const tooltip = useTooltip();
  if (totals.length === 0) {
    return <p className="text-sm text-muted">この期間に完了したタスクはありません。</p>;
  }
  const max = Math.max(1, ...totals.map((t) => t[metric]));
  const unit = metric === "points" ? "pt" : "件";

  return (
    <>
      <ul className="grid gap-1.5">
        {totals.map((t) => {
          const tag = tags.find((x) => x.id === t.tagId);
          const name = tag?.name ?? "タグなし";
          return (
            <li
              key={t.tagId ?? "none"}
              className="grid grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)] items-center gap-3 text-sm"
              {...tooltip.bind(`${name}: ${t.points} pt・${t.count} 件`)}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: tag === undefined ? "var(--nw-muted)" : tagColorVar(tag.color),
                  }}
                  aria-hidden="true"
                />
                <span className={`truncate ${tag === undefined ? "text-muted" : ""}`}>{name}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3.5 rounded-r-[4px] bg-accent"
                  style={{ width: `${(t[metric] / max) * 100}%`, minWidth: t[metric] > 0 ? 4 : 0 }}
                  aria-hidden="true"
                />
                <span className="shrink-0 font-mark text-xs tabular-nums text-muted">
                  {t[metric]} {unit}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {tooltip.node}
    </>
  );
};
