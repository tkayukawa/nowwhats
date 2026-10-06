import type { TaskDto } from "@nowwhats/task-management";
import { isOpen, matchesDueFilter, type DueFilter } from "../task-view.ts";

const FILTERS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "today", label: "今日まで" },
  { value: "week", label: "7日以内" },
  { value: "none", label: "期限なし" },
];

export interface DueFiltersProps {
  readonly tasks: readonly TaskDto[];
  readonly today: Date;
  readonly value: DueFilter;
  readonly onChange: (value: DueFilter) => void;
}

/** 期限で絞り込む。件数は未完了のタスクだけを数える */
export const DueFilters = ({ tasks, today, value, onChange }: DueFiltersProps) => (
  <nav
    aria-label="期限で絞り込み"
    className="flex w-fit max-w-full flex-wrap gap-1 rounded-[10px] bg-faint p-[3px]"
  >
    {FILTERS.map((f) => (
      <button
        key={f.value}
        type="button"
        aria-pressed={value === f.value}
        onClick={() => onChange(f.value)}
        className="rounded-lg px-3 py-0.5 text-sm text-muted aria-pressed:bg-surface aria-pressed:font-bold aria-pressed:text-fg aria-pressed:shadow-sm"
      >
        {f.label}
        <span className="ml-1 font-mark font-medium tabular-nums">
          {tasks.filter((t) => isOpen(t.status) && matchesDueFilter(t, f.value, today)).length}
        </span>
      </button>
    ))}
  </nav>
);
