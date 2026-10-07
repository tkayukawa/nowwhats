import type { TagDto, TaskDto, TaskStatus } from "@nowwhats/task-management";

/** 一覧の表示に関する判断（並び順・絞り込み・期限の表示）。画面の部品から切り離してテストする。 */

export type DueFilter = "all" | "today" | "week" | "none";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export const isOpen = (status: TaskStatus): boolean => status === "todo" || status === "doing";

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** 期限日から今日までの日数差（期限が過去なら負） */
const daysUntil = (dueDate: string, today: Date): number =>
  Math.round((startOfDay(new Date(dueDate)).getTime() - startOfDay(today).getTime()) / DAY_MS);

export interface DueInfo {
  readonly text: string;
  readonly tone: "overdue" | "today" | "normal";
}

/** 期限日を「今日」「明日」「10/10(土)」の形で表す */
export const dueLabel = (dueDate: string, today: Date): string => {
  const diff = daysUntil(dueDate, today);
  if (diff === 0) return "今日";
  if (diff === 1) return "明日";
  const d = new Date(dueDate);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};

export const dueInfo = (task: TaskDto, today: Date): DueInfo | null => {
  if (task.dueDate === null) return null;
  const diff = daysUntil(task.dueDate, today);
  const open = isOpen(task.status);
  if (open && diff < 0) return { text: `${-diff}日超過`, tone: "overdue" };
  return { text: dueLabel(task.dueDate, today), tone: open && diff === 0 ? "today" : "normal" };
};

export const matchesDueFilter = (task: TaskDto, filter: DueFilter, today: Date): boolean => {
  if (filter === "all") return true;
  if (filter === "none") return task.dueDate === null;
  if (task.dueDate === null) return false;
  const diff = daysUntil(task.dueDate, today);
  return filter === "today" ? diff <= 0 : diff <= 7;
};

/** 期限の近い順（期限なしは最後）→ 優先度の高い順 → 作成順（UUIDv7 の昇順） */
export const compareTasks = (a: TaskDto, b: TaskDto): number => {
  const due = (t: TaskDto) => (t.dueDate === null ? Infinity : new Date(t.dueDate).getTime());
  return (
    due(a) - due(b) ||
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.id.localeCompare(b.id)
  );
};

export interface TaskGroups {
  readonly doing: TaskDto[];
  readonly todo: TaskDto[];
  readonly closed: TaskDto[];
}

export const groupTasks = (tasks: readonly TaskDto[]): TaskGroups => {
  const sorted = [...tasks].sort(compareTasks);
  return {
    doing: sorted.filter((t) => t.status === "doing"),
    todo: sorted.filter((t) => t.status === "todo"),
    closed: sorted.filter((t) => !isOpen(t.status)),
  };
};

export const sumPoints = (tasks: readonly TaskDto[]): number =>
  tasks.reduce((n, t) => n + t.storyPoints, 0);

/** 期限の選択肢（今日・明日）を、その日の 0 時（端末のタイムゾーン）として ISO 文字列にする */
export const dueDateFromToday = (days: number, today: Date): string =>
  new Date(startOfDay(today).getTime() + days * DAY_MS).toISOString();

/** <input type="date"> の値（YYYY-MM-DD）を、その日の 0 時（端末のタイムゾーン）として ISO 文字列にする */
export const dueDateFromInput = (value: string): string | null => {
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y + m + d)) return null;
  return new Date(y, m - 1, d).toISOString();
};

/** ID の一覧から、存在するタグだけを指定した順で返す（削除済みのタグは表示しない。ADR 0007） */
export const resolveTags = (ids: readonly string[], tags: readonly TagDto[]): TagDto[] =>
  ids.flatMap((id) => tags.filter((t) => t.id === id));
