import type { RejectedChange, SyncReport } from "@nowwhats/sync";
import type { TaskAction, TaskDto } from "@nowwhats/task-management";

/** メインスレッド → Worker への要求 */
export type WorkerRequest =
  | { readonly type: "init" }
  | { readonly type: "listTasks" }
  | { readonly type: "createTask"; readonly title: string }
  | { readonly type: "changeStatus"; readonly id: string; readonly action: TaskAction }
  | { readonly type: "sync" };

export interface LocalSnapshot {
  readonly tasks: TaskDto[];
  readonly pending: number;
  readonly persistent: boolean;
}

/** 要求の種類ごとの応答 */
export interface WorkerResponseMap {
  init: LocalSnapshot;
  listTasks: LocalSnapshot;
  createTask: { readonly error: string | null };
  changeStatus: { readonly error: string | null };
  sync: SyncReport;
}

export type WorkerMessage =
  | { readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly id: number; readonly ok: false; readonly error: string };

export type { RejectedChange };
