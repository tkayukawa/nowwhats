import type { CreateTaskError, ChangeTaskStatusError, TaskDto } from "@nowwhats/task-management";

export type CommandError = CreateTaskError | ChangeTaskStatusError;

/** push した変更 1 件ごとの処理結果 */
export type ChangeResult =
  | { readonly changeId: string; readonly status: "applied" }
  | { readonly changeId: string; readonly status: "rejected"; readonly error: CommandError };

/** pull で返す変更。seq はサーバーで採番する単調増加の連番 */
export interface TaskChange {
  readonly seq: number;
  readonly task: TaskDto;
}

export interface PullResult {
  readonly changes: TaskChange[];
  /** 次回の pull で渡すカーソル（取得済みの最大 seq） */
  readonly cursor: number;
  /** まだ取得していない変更が残っているか */
  readonly hasMore: boolean;
}
