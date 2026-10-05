import type { Priority, TaskAction } from "@nowwhats/task-management";

/**
 * 同期で送受信する「操作」。クライアントは実行した操作を Outbox に記録し、
 * サーバーは同じユースケースで再実行して検証する（ADR 0006）。
 */
export type TaskCommand =
  | {
      readonly type: "CreateTask";
      readonly id: string;
      readonly title: string;
      readonly priority?: Priority | undefined;
      /** ISO 8601 文字列。null は期限なし */
      readonly dueDate?: string | null | undefined;
    }
  | {
      readonly type: "ChangeTaskStatus";
      readonly id: string;
      readonly action: TaskAction;
    };

/** 送信待ちの変更。changeId はクライアントで生成し、再送時の重複適用を防ぐ。 */
export interface PendingChange {
  readonly changeId: string;
  readonly command: TaskCommand;
}
