import type { TaskAction, TaskDto } from "@nowwhats/task-management";
import { useState } from "react";
import { groupTasks, sumPoints } from "../task-view.ts";
import { TaskRow } from "./task-row.tsx";

const groupHead =
  "flex items-baseline gap-1.5 px-2 pt-0.5 pb-1 text-xs font-bold tracking-wider text-muted";

const Points = ({ value, prefix = "" }: { value: number; prefix?: string }) => (
  <span className="font-mark font-medium tracking-normal tabular-nums">
    · {prefix}
    {value} pt
  </span>
);

export interface TaskListProps {
  readonly tasks: readonly TaskDto[];
  readonly today: Date;
  readonly onAction: (id: string, action: TaskAction) => void;
}

export const TaskList = ({ tasks, today, onAction }: TaskListProps) => {
  const [closedOpen, setClosedOpen] = useState(false);
  const groups = groupTasks(tasks);
  const open = [
    { name: "進行中", items: groups.doing },
    { name: "未着手", items: groups.todo },
  ].filter((g) => g.items.length > 0);

  const rows = (items: readonly TaskDto[]) => (
    <ul className="border-t border-faint">
      {items.map((t) => (
        <TaskRow key={t.id} task={t} today={today} onAction={onAction} />
      ))}
    </ul>
  );

  return (
    <div className="grid gap-3">
      {open.map((g) => (
        <section key={g.name} aria-label={g.name}>
          <h2 className={groupHead}>
            {g.name}
            <span className="font-mark font-medium tabular-nums">{g.items.length}</span>
            <Points value={sumPoints(g.items)} />
          </h2>
          {rows(g.items)}
        </section>
      ))}
      {open.length === 0 && (
        <p className="px-2 py-2 text-sm text-muted">
          この条件のやることはありません。上の入力欄から追加できます。
        </p>
      )}
      {groups.closed.length > 0 && (
        <section aria-label="完了・中止">
          <button
            type="button"
            aria-expanded={closedOpen}
            onClick={() => setClosedOpen((v) => !v)}
            className={`${groupHead} text-left`}
          >
            {closedOpen ? "▾" : "▸"} 完了・中止
            <span className="font-mark font-medium tabular-nums">{groups.closed.length}</span>
            <Points
              prefix="完了 "
              value={sumPoints(groups.closed.filter((t) => t.status === "done"))}
            />
          </button>
          {closedOpen && rows(groups.closed)}
        </section>
      )}
    </div>
  );
};
