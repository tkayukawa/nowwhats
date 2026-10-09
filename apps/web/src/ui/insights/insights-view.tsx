import {
  completionsByTag,
  completionsOf,
  dailyStatusCounts,
  dailyCompletions,
  recentCompletionsByDay,
  startOfDay,
  startOfWeek,
  summarizeWeeks,
  weeklyCompletions,
} from "@nowwhats/insights";
import type { TagDto, TaskDto } from "@nowwhats/task-management";
import { useState, type ReactNode } from "react";
import { ghostButton } from "../classes.ts";
import { ActivityCalendar } from "./activity-calendar.tsx";
import { StatusFlowChart, StatusFlowTable, StatusLegend } from "./status-flow-chart.tsx";
import { TagChart, type TagMetric } from "./tag-chart.tsx";
import { formatDay, formatDelta } from "./format.ts";
import { VelocityChart, VelocityTable } from "./velocity-chart.tsx";

const Tile = ({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
}) => (
  <div className="grid gap-0.5 rounded-xl border border-faint bg-surface px-4 py-3">
    <span className="text-xs text-muted">{label}</span>
    <span className="text-[1.75rem] leading-tight font-bold">
      {value}
      <small className="ml-1 text-sm font-medium text-muted">{unit}</small>
    </span>
    <span className="text-xs text-muted tabular-nums">{note}</span>
  </div>
);

const Panel = ({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section
    aria-label={title}
    className="grid min-w-0 gap-2.5 rounded-xl border border-faint bg-surface px-4 py-3.5"
  >
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[0.95rem] font-bold">{title}</h2>
      <p className="text-xs text-muted">{note}</p>
      {action !== undefined && <div className="ml-auto">{action}</div>}
    </div>
    {children}
  </section>
);

type TagPeriod = "week" | "4weeks" | "all";

const TAG_PERIODS: { value: TagPeriod; label: string }[] = [
  { value: "week", label: "今週" },
  { value: "4weeks", label: "直近 4 週" },
  { value: "all", label: "すべて" },
];

const segment =
  "rounded-md px-2.5 py-0.5 text-xs text-muted aria-pressed:bg-surface aria-pressed:font-bold aria-pressed:text-fg aria-pressed:shadow-sm";

export const InsightsView = ({
  tasks,
  tags,
  today,
}: {
  readonly tasks: readonly TaskDto[];
  readonly tags: readonly TagDto[];
  readonly today: Date;
}) => {
  const [asTable, setAsTable] = useState(false);
  const [flowAsTable, setFlowAsTable] = useState(false);
  const [tagPeriod, setTagPeriod] = useState<TagPeriod>("4weeks");
  const [tagMetric, setTagMetric] = useState<TagMetric>("points");
  const completions = completionsOf(tasks);
  const weekly = weeklyCompletions(completions, today, 8);
  const summary = summarizeWeeks(weekly);
  const daily = dailyCompletions(completions, today, 12);
  const recent = recentCompletionsByDay(completions, today);
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const todayKey = startOfDay(today).getTime();
  const statusCounts = dailyStatusCounts(tasks, today, 28);
  const tagFrom =
    tagPeriod === "all"
      ? null
      : new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() - (tagPeriod === "week" ? 0 : 21),
        );
  const tagTotals = completionsByTag(
    tasks,
    tags.map((t) => t.id),
    tagFrom,
  );
  const yesterdayKey = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  ).getTime();

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-xl font-bold">実績</h1>
        <p className="text-sm text-muted">
          今週: {formatDay(weekStart)} 〜 {formatDay(weekEnd)}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Tile
          label="今週の完了ポイント"
          value={String(summary.thisWeek.points)}
          unit="pt"
          note={formatDelta(summary.thisWeek.points, summary.lastWeek.points, "pt")}
        />
        <Tile
          label="今週の完了タスク"
          value={String(summary.thisWeek.count)}
          unit="件"
          note={formatDelta(summary.thisWeek.count, summary.lastWeek.count, "件")}
        />
        <Tile
          label="平均ベロシティ"
          value={summary.averagePoints.toFixed(1)}
          unit="pt / 週"
          note="今週を除く直近 7 週"
        />
      </div>

      <Panel
        title="完了ポイントの推移"
        note="週ごと・直近 8 週。横線は平均"
        action={
          <button
            type="button"
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
            className={`${ghostButton} py-0.5 text-xs`}
          >
            {asTable ? "グラフで見る" : "表で見る"}
          </button>
        }
      >
        {asTable ? (
          <VelocityTable weekly={weekly} />
        ) : (
          <VelocityChart weekly={weekly} average={summary.averagePoints} />
        )}
      </Panel>

      <Panel
        title="状態の推移"
        note="日ごとの件数（累積フロー図）・直近 4 週"
        action={
          <button
            type="button"
            aria-pressed={flowAsTable}
            onClick={() => setFlowAsTable((v) => !v)}
            className={`${ghostButton} py-0.5 text-xs`}
          >
            {flowAsTable ? "グラフで見る" : "表で見る"}
          </button>
        }
      >
        <StatusLegend />
        {flowAsTable ? (
          <StatusFlowTable counts={statusCounts} />
        ) : (
          <StatusFlowChart counts={statusCounts} />
        )}
        <p className="text-xs text-muted">
          状態の履歴の記録を始める前に登録したタスクは、記録を始めた後の状態の変更から数えます。中止したタスクは数えません。
        </p>
      </Panel>

      <Panel
        title="タグ別の完了"
        note={tagMetric === "points" ? "完了ポイント" : "完了件数"}
        action={
          <div className="flex flex-wrap gap-2">
            <div role="group" aria-label="期間" className="flex gap-0.5 rounded-lg bg-faint p-0.5">
              {TAG_PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={tagPeriod === p.value}
                  onClick={() => setTagPeriod(p.value)}
                  className={segment}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div
              role="group"
              aria-label="数える対象"
              className="flex gap-0.5 rounded-lg bg-faint p-0.5"
            >
              <button
                type="button"
                aria-pressed={tagMetric === "points"}
                onClick={() => setTagMetric("points")}
                className={segment}
              >
                ポイント
              </button>
              <button
                type="button"
                aria-pressed={tagMetric === "count"}
                onClick={() => setTagMetric("count")}
                className={segment}
              >
                件数
              </button>
            </div>
          </div>
        }
      >
        <TagChart totals={tagTotals} tags={tags} metric={tagMetric} />
        <p className="text-xs text-muted">
          複数のタグが付いたタスクは、それぞれのタグに数えます（合計は完了の総数より多くなります）。
        </p>
      </Panel>

      <Panel title="活動カレンダー" note="日ごとの完了ポイント・直近 12 週">
        <ActivityCalendar daily={daily} />
      </Panel>

      <Panel title="完了したタスク" note="今週と先週">
        {recent.length === 0 ? (
          <p className="text-sm text-muted">今週と先週に完了したタスクはまだありません。</p>
        ) : (
          <div className="grid max-h-[360px] gap-1 overflow-auto">
            {recent.map((day) => {
              const key = day.date.getTime();
              return (
                <section key={key} aria-label={formatDay(day.date)}>
                  <h3 className="flex gap-2 pt-1.5 pb-0.5 text-xs font-bold text-muted">
                    {key === todayKey
                      ? "今日"
                      : key === yesterdayKey
                        ? "昨日"
                        : formatDay(day.date)}
                    <span className="font-mark font-medium tabular-nums">{day.points} pt</span>
                  </h3>
                  <ul>
                    {day.items.map((c) => (
                      <li
                        key={c.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-faint py-1 text-sm"
                      >
                        <span
                          className="grid size-4 place-items-center rounded-full bg-brand text-[0.6rem] font-bold text-on-brand"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span className="truncate">{c.title}</span>
                        <span className="min-w-10 rounded-md bg-faint px-1.5 text-center font-mark text-xs text-muted tabular-nums">
                          {c.points} pt
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      <p className="text-xs text-muted">
        完了日時の記録を始める前に完了したタスクは、集計に含まれません。
      </p>
    </>
  );
};
