import type { RejectedChange, SyncReport } from "@nowwhats/sync";
import type { Priority, TagDto, TaskAction, TaskDto } from "@nowwhats/task-management";

export interface NewTask {
  readonly title: string;
  readonly priority: Priority;
  /** ISO 8601。null は期限なし */
  readonly dueDate: string | null;
  readonly storyPoints: number;
  readonly tagIds: readonly string[];
}

/** 変更する項目だけを指定する（dueDate は ISO 8601。null は期限なし） */
export interface TaskEdits {
  readonly title?: string;
  readonly description?: string;
  readonly priority?: Priority;
  readonly dueDate?: string | null;
  readonly storyPoints?: number;
  readonly tagIds?: readonly string[];
}

/** メインスレッド → Worker への要求 */
export type WorkerRequest =
  | { readonly type: "init" }
  | { readonly type: "listTasks" }
  | { readonly type: "createTask"; readonly task: NewTask }
  | { readonly type: "changeStatus"; readonly id: string; readonly action: TaskAction }
  | { readonly type: "editTask"; readonly id: string; readonly changes: TaskEdits }
  | { readonly type: "createTag"; readonly name: string }
  | { readonly type: "renameTag"; readonly id: string; readonly name: string }
  | { readonly type: "recolorTag"; readonly id: string; readonly color: string }
  | { readonly type: "deleteTag"; readonly id: string }
  | { readonly type: "sync" };

export interface LocalSnapshot {
  readonly tasks: TaskDto[];
  readonly tags: TagDto[];
  readonly pending: number;
  readonly persistent: boolean;
}

/** 要求の種類ごとの応答 */
export interface WorkerResponseMap {
  init: LocalSnapshot;
  listTasks: LocalSnapshot;
  createTask: { readonly error: string | null };
  changeStatus: { readonly error: string | null };
  editTask: { readonly error: string | null };
  /** 作成したタグの ID。失敗時は null と error */
  createTag: { readonly id: string | null; readonly error: string | null };
  renameTag: { readonly error: string | null };
  recolorTag: { readonly error: string | null };
  deleteTag: { readonly error: string | null };
  sync: SyncReport;
}

export type WorkerMessage =
  | { readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly id: number; readonly ok: false; readonly error: string };

export type { RejectedChange };
