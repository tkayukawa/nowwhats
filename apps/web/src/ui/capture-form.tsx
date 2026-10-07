import {
  DEFAULT_STORY_POINT,
  STORY_POINT_SCALE,
  type Priority,
  type TagDto,
} from "@nowwhats/task-management";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { NewTask } from "../local/protocol.ts";
import { dueDateFromInput, dueDateFromToday, dueLabel } from "../task-view.ts";
import { chip, chipSelected, primaryButton } from "./classes.ts";
import { TagField } from "./tags.tsx";

interface Draft {
  readonly priority: Priority;
  readonly dueDate: string | null;
  readonly storyPoints: number;
  readonly tagIds: readonly string[];
}

const INITIAL: Draft = {
  priority: "medium",
  dueDate: null,
  storyPoints: DEFAULT_STORY_POINT,
  tagIds: [],
};

export interface CaptureFormProps {
  readonly disabled: boolean;
  readonly tags: readonly TagDto[];
  /** 新しいタグを作る。成功したら ID、失敗したら null を返す */
  readonly onCreateTag: (name: string) => Promise<string | null>;
  /** 失敗時は利用者向けのエラー文言を返す */
  readonly onSubmit: (task: NewTask) => Promise<string | null>;
}

export const CaptureForm = ({ disabled, tags, onCreateTag, onSubmit }: CaptureFormProps) => {
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const quickDue = [
    { label: "今日", value: dueDateFromToday(0, today) },
    { label: "明日", value: dueDateFromToday(1, today) },
  ];
  const customDue =
    draft.dueDate !== null && !quickDue.some((q) => q.value === draft.dueDate)
      ? dueLabel(draft.dueDate, today)
      : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const failure = await onSubmit({ title, ...draft });
    setError(failure);
    if (failure === null) {
      setTitle("");
      setDraft(INITIAL);
    }
  };

  // 日本語入力の変換確定の Enter では登録しない
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) {
      e.preventDefault();
    }
  };

  return (
    <div className="grid gap-1.5">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        autoComplete="off"
        className="grid gap-2 rounded-xl border border-faint bg-surface px-4 pt-3 pb-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.18)] focus-within:border-accent"
      >
        <label htmlFor="capture-title" className="text-xs tracking-wider text-muted">
          いま、なにする？
        </label>
        <div className="flex items-center gap-2">
          <input
            id="capture-title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="やること・やりたいことを書いて Enter"
            autoFocus
            className="min-w-0 flex-1 bg-transparent py-0.5 text-lg font-medium outline-none placeholder:text-muted/70"
          />
          <button
            type="submit"
            disabled={disabled || title.trim() === ""}
            className={primaryButton}
          >
            登録
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="優先度と期限">
          {(["high", "low"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={draft.priority === p}
              onClick={() => setDraft((d) => ({ ...d, priority: d.priority === p ? "medium" : p }))}
              className={chip}
            >
              {p === "high" ? "優先度 高" : "低"}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-faint" aria-hidden="true" />
          {quickDue.map((q) => (
            <button
              key={q.label}
              type="button"
              aria-pressed={draft.dueDate === q.value}
              onClick={() =>
                setDraft((d) => ({ ...d, dueDate: d.dueDate === q.value ? null : q.value }))
              }
              className={chip}
            >
              {q.label}
            </button>
          ))}
          <label className={`relative ${chip} ${customDue !== null ? chipSelected : ""}`}>
            {customDue !== null ? `期限 ${customDue}` : "日付を指定"}
            <input
              type="date"
              aria-label="期限の日付"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) =>
                setDraft((d) => ({ ...d, dueDate: dueDateFromInput(e.target.value) }))
              }
            />
          </label>
        </div>
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="ストーリーポイント"
        >
          <span className="mr-1 text-xs text-muted">ポイント</span>
          {STORY_POINT_SCALE.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={draft.storyPoints === p}
              onClick={() => setDraft((d) => ({ ...d, storyPoints: p }))}
              className={`min-w-8 px-1.5 font-mark tabular-nums ${chip}`}
            >
              {p}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted max-sm:hidden">
            日本語変換中の Enter では登録しません
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="タグ">
          <span className="mr-1 text-xs text-muted">タグ</span>
          <TagField
            label="登録するタスクのタグ"
            tags={tags}
            selectedIds={draft.tagIds}
            onChange={(tagIds) => setDraft((d) => ({ ...d, tagIds }))}
            onCreate={onCreateTag}
          />
        </div>
      </form>
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
