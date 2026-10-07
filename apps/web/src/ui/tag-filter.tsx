import type { TagDto, TaskDto } from "@nowwhats/task-management";
import { isOpen } from "../task-view.ts";
import { chip } from "./classes.ts";
import { tagColorVar } from "./tags.tsx";

export interface TagFilterProps {
  readonly tasks: readonly TaskDto[];
  readonly tags: readonly TagDto[];
  /** 選択中のタグ ID。null はすべて */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
}

/** タグで絞り込む。件数は未完了のタスクだけを数える */
export const TagFilter = ({ tasks, tags, value, onChange }: TagFilterProps) => {
  if (tags.length === 0) return null;
  return (
    <nav aria-label="タグで絞り込み" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-xs text-muted">タグ</span>
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={chip}
      >
        すべてのタグ
      </button>
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          onClick={() => onChange(value === t.id ? null : t.id)}
          className={`inline-flex items-center gap-1 ${chip}`}
        >
          <span
            className="size-[7px] rounded-full"
            style={{ background: tagColorVar(t.color) }}
            aria-hidden="true"
          />
          {t.name}
          <span className="font-mark font-medium tabular-nums">
            {tasks.filter((task) => isOpen(task.status) && task.tagIds.includes(t.id)).length}
          </span>
        </button>
      ))}
    </nav>
  );
};
