import {
  availableActions,
  STORY_POINT_SCALE,
  type Priority,
  type TaskAction,
  type TaskDto,
} from "@nowwhats/task-management";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CloseIcon } from "../icons.tsx";
import { STATUS_LABEL } from "../labels.ts";
import type { TaskEdits } from "../local/protocol.ts";
import { dueDateFromInput, dueDateFromToday, dueInfo } from "../task-view.ts";
import { chip, ghostButton, primaryButton } from "./classes.ts";
import { Markdown } from "./markdown.tsx";

const ACTION_BUTTON: Record<TaskAction, string> = {
  start: "着手する",
  complete: "完了にする",
  cancel: "中止する",
  reopen: "未着手に戻す",
};

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

/** 日本語入力の変換確定の Enter かどうか */
const isComposing = (e: KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229;

/** <input type="date"> 用に、ISO 文字列を端末のタイムゾーンの YYYY-MM-DD にする */
const toDateInputValue = (iso: string | null): string => {
  if (iso === null) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface TaskDetailProps {
  readonly task: TaskDto;
  readonly today: Date;
  /** 失敗時は利用者向けのエラー文言を返す */
  readonly onEdit: (changes: TaskEdits) => Promise<string | null>;
  readonly onAction: (action: TaskAction) => void;
  readonly onClose: () => void;
}

export const TaskDetail = ({ task, today, onEdit, onAction, onClose }: TaskDetailProps) => {
  const [title, setTitle] = useState(task.title);
  const [editingDescription, setEditingDescription] = useState(false);
  const [draft, setDraft] = useState(task.description);
  const [previewDraft, setPreviewDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 別のタスクを開いたとき・同期で内容が変わったときに表示を合わせる
  useEffect(() => {
    setTitle(task.title);
    if (!editingDescription) setDraft(task.description);
  }, [task.id, task.title, task.description, editingDescription]);

  useEffect(() => {
    setEditingDescription(false);
    setError(null);
    closeRef.current?.focus();
  }, [task.id]);

  // Esc で閉じる（説明文の編集中は、編集の取り消しを優先する）
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return;
      if (editingDescription) {
        setEditingDescription(false);
        setDraft(task.description);
      } else {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editingDescription, task.description, onClose]);

  const save = async (changes: TaskEdits) => setError(await onEdit(changes));

  const saveTitle = () => {
    if (title.trim() === "") {
      setTitle(task.title);
      return;
    }
    if (title !== task.title) void save({ title });
  };

  const saveDescription = async () => {
    const failure = await onEdit({ description: draft });
    setError(failure);
    if (failure === null) {
      setEditingDescription(false);
      setPreviewDraft(false);
    }
  };

  const due = dueInfo(task, today);

  return (
    <aside
      aria-label="タスクの詳細"
      className="fixed inset-y-0 right-0 z-50 grid w-[min(440px,100vw)] grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-3.5 overflow-y-auto border-l border-faint bg-surface px-5 pt-3 pb-5 shadow-[-16px_0_40px_-24px_rgb(0_0_0/0.4)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{STATUS_LABEL[task.status]}</span>
        {availableActions(task.status).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            className={ghostButton}
          >
            {ACTION_BUTTON[action]}
          </button>
        ))}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="詳細を閉じる"
          className="ml-auto grid size-9 place-items-center rounded-lg text-muted hover:bg-faint hover:text-fg"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <div className="grid gap-1">
        <label htmlFor="detail-title" className="sr-only">
          タイトル
        </label>
        <textarea
          id="detail-title"
          value={title}
          rows={2}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isComposing(e)) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="field-sizing-content resize-none rounded-lg bg-transparent px-1 py-0.5 text-xl leading-snug font-bold outline-none hover:bg-faint/50 focus:bg-bg"
        />
        {error !== null && (
          <p role="alert" className="px-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">優先度</dt>
        <dd className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={task.priority === p.value}
              onClick={() => void save({ priority: p.value })}
              className={chip}
            >
              {p.label}
            </button>
          ))}
        </dd>

        <dt className="text-muted">期限</dt>
        <dd className="flex flex-wrap items-center gap-1.5">
          {[
            { label: "今日", days: 0 },
            { label: "明日", days: 1 },
          ].map((q) => {
            const value = dueDateFromToday(q.days, today);
            return (
              <button
                key={q.label}
                type="button"
                aria-pressed={task.dueDate === value}
                onClick={() => void save({ dueDate: value })}
                className={chip}
              >
                {q.label}
              </button>
            );
          })}
          <input
            type="date"
            aria-label="期限の日付"
            value={toDateInputValue(task.dueDate)}
            onChange={(e) => void save({ dueDate: dueDateFromInput(e.target.value) })}
            className="rounded-md border border-faint bg-bg px-2 py-0.5 text-sm"
          />
          {task.dueDate !== null && (
            <button
              type="button"
              onClick={() => void save({ dueDate: null })}
              className="text-xs text-muted underline hover:text-fg"
            >
              期限をなくす
            </button>
          )}
          {due?.tone === "overdue" && (
            <span className="text-xs font-bold text-danger">{due.text}</span>
          )}
        </dd>

        <dt className="text-muted">ポイント</dt>
        <dd className="flex flex-wrap gap-1">
          {STORY_POINT_SCALE.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={task.storyPoints === p}
              onClick={() => void save({ storyPoints: p })}
              className={`min-w-8 px-1.5 font-mark tabular-nums ${chip}`}
            >
              {p}
            </button>
          ))}
        </dd>
      </dl>

      <section aria-label="説明" className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
        <div className="flex items-center gap-1" role="tablist">
          <h2 className="mr-2 text-sm font-bold">説明</h2>
          {editingDescription && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={!previewDraft}
                onClick={() => setPreviewDraft(false)}
                className="rounded-md px-2.5 py-0.5 text-xs text-muted aria-selected:bg-faint aria-selected:font-bold aria-selected:text-fg"
              >
                編集
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewDraft}
                onClick={() => setPreviewDraft(true)}
                className="rounded-md px-2.5 py-0.5 text-xs text-muted aria-selected:bg-faint aria-selected:font-bold aria-selected:text-fg"
              >
                プレビュー
              </button>
            </>
          )}
          <span className="ml-auto text-xs text-muted">Markdown で書けます</span>
          {!editingDescription && (
            <button
              type="button"
              onClick={() => setEditingDescription(true)}
              className={`ml-2 ${ghostButton}`}
            >
              編集
            </button>
          )}
        </div>

        {!editingDescription ? (
          <div className="min-h-24 overflow-auto px-1">
            {task.description === "" ? (
              <p className="text-sm text-muted">
                説明はまだありません。「編集」から Markdown で書けます。
              </p>
            ) : (
              <Markdown source={task.description} />
            )}
          </div>
        ) : previewDraft ? (
          <div className="min-h-24 overflow-auto rounded-lg border border-faint p-2">
            {draft === "" ? (
              <span className="text-sm text-muted">説明はまだありません。</span>
            ) : (
              <Markdown source={draft} />
            )}
          </div>
        ) : (
          <textarea
            aria-label="説明（Markdown）"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl / ⌘ + Enter で保存
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isComposing(e)) {
                e.preventDefault();
                void saveDescription();
              }
            }}
            className="min-h-48 resize-none rounded-lg border border-faint bg-bg px-3 py-2.5 font-mono text-sm leading-relaxed outline-none focus:border-accent"
          />
        )}

        {editingDescription && (
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted">Ctrl / ⌘ + Enter で保存</span>
            <button
              type="button"
              onClick={() => {
                setEditingDescription(false);
                setDraft(task.description);
                setPreviewDraft(false);
              }}
              className={ghostButton}
            >
              取り消す
            </button>
            <button type="button" onClick={() => void saveDescription()} className={primaryButton}>
              保存
            </button>
          </div>
        )}
      </section>
    </aside>
  );
};
