import {
  availableActions,
  type TagDto,
  type TaskAction,
  type TaskDto,
} from "@nowwhats/task-management";
import { useEffect, useRef, useState } from "react";
import { NoteIcon } from "../icons.tsx";
import { dueInfo, isOpen, resolveTags } from "../task-view.ts";
import { TagChip } from "./tags.tsx";

const MENU_LABEL: Record<TaskAction, string> = {
  start: "着手する",
  complete: "完了にする",
  cancel: "中止する",
  reopen: "未着手に戻す",
};

const DUE_TONE = {
  overdue: "font-bold text-danger",
  today: "font-bold text-warn",
  normal: "",
} as const;

/** 完了の丸。進行中は半分、完了は全体を塗る */
const checkStyle = (status: TaskDto["status"]): string => {
  switch (status) {
    case "doing":
      return "border-accent bg-[linear-gradient(90deg,var(--nw-accent)_50%,transparent_50%)]";
    case "done":
      return "border-brand bg-brand text-on-brand";
    case "canceled":
      return "border-dashed border-muted/60";
    case "todo":
      return "border-muted/60 hover:border-accent";
  }
};

export interface TaskRowProps {
  readonly task: TaskDto;
  readonly tags: readonly TagDto[];
  readonly today: Date;
  readonly selected: boolean;
  readonly onAction: (id: string, action: TaskAction) => void;
  readonly onOpen: (id: string) => void;
}

export const TaskRow = ({ task, tags, today, selected, onAction, onOpen }: TaskRowProps) => {
  const taskTags = resolveTags(task.tagIds, tags);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const primary: TaskAction = isOpen(task.status) ? "complete" : "reopen";
  const due = dueInfo(task, today);
  const closed = !isOpen(task.status);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  return (
    <li
      className={`group grid min-h-[38px] grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b border-faint py-1 pr-1 pl-2 ${
        selected ? "bg-accent-soft" : "hover:bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={() => onAction(task.id, primary)}
        aria-label={`${task.title} を${MENU_LABEL[primary]}`}
        className={`grid size-[18px] place-items-center rounded-full border-[1.5px] text-[0.6rem] font-bold ${checkStyle(task.status)}`}
      >
        {task.status === "done" && "✓"}
      </button>

      <button
        type="button"
        onClick={() => onOpen(task.id)}
        aria-label={`${task.title} の詳細を開く`}
        className="flex min-w-0 items-center gap-2 text-left max-[520px]:flex-wrap"
      >
        <span
          className={`min-w-0 truncate text-[0.925rem] max-[520px]:line-clamp-2 max-[520px]:basis-full max-[520px]:whitespace-normal ${
            closed ? "text-muted line-through decoration-muted/60" : ""
          }`}
        >
          {task.title}
        </span>
        {taskTags.length > 0 && (
          <span className="inline-flex shrink-0 gap-1">
            {taskTags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </span>
        )}
        {task.description !== "" && (
          <NoteIcon
            className="size-3.5 shrink-0 text-muted"
            aria-label="説明あり"
            aria-hidden={false}
          />
        )}
        <span className="ml-auto flex shrink-0 gap-2 text-xs whitespace-nowrap text-muted max-[520px]:ml-0">
          {task.status === "doing" && <span className="font-bold text-accent">進行中</span>}
          {task.priority === "high" && (
            <span className="inline-flex items-center gap-1 font-bold text-danger">
              <span className="size-1.5 rounded-full bg-danger" aria-hidden="true" />高
              <span className="sr-only">優先度</span>
            </span>
          )}
          {due !== null && (
            <span className={DUE_TONE[due.tone]}>
              <span className="sr-only">期限 </span>
              {due.text}
            </span>
          )}
        </span>
      </button>

      <span
        title="ストーリーポイント"
        className={`min-w-10 rounded-md bg-faint px-1.5 text-center font-mark text-xs tabular-nums text-muted ${closed ? "opacity-60" : ""}`}
      >
        {task.storyPoints} pt
      </span>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`${task.title} の操作`}
          onClick={() => setMenuOpen((v) => !v)}
          className="size-7 rounded-md text-muted opacity-50 group-hover:bg-faint group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:bg-faint aria-expanded:opacity-100"
        >
          ⋯
        </button>
        {menuOpen && (
          <ul
            role="menu"
            className="absolute top-8 right-0 z-20 min-w-32 rounded-xl border border-faint bg-surface p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]"
          >
            {availableActions(task.status).map((action) => (
              <li key={action}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onAction(task.id, action);
                  }}
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent-soft"
                >
                  {MENU_LABEL[action]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};
