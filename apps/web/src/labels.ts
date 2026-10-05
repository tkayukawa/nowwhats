import type { TaskAction, TaskDto } from "@nowwhats/task-management";
import { errorMessage } from "./error-message.ts";
import type { RejectedChange } from "./local/protocol.ts";
import type { LocalTasksState } from "./local/use-local-tasks.ts";

export const ACTION_LABEL: Record<TaskAction, string> = {
  start: "着手",
  complete: "完了",
  cancel: "中止",
  reopen: "再開",
};

export const STATUS_LABEL: Record<TaskDto["status"], string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
  canceled: "中止",
};

export const syncLabel = (s: LocalTasksState): string => {
  if (!s.online) return `オフライン（未送信 ${s.pending} 件）`;
  if (s.syncStatus === "syncing") return "同期中…";
  if (s.syncStatus === "failed")
    return `同期に失敗しました（未送信 ${s.pending} 件・自動で再試行します）`;
  if (s.pending > 0) return `未送信 ${s.pending} 件`;
  return "同期済み";
};

export const rejectionLabel = (r: RejectedChange): string => {
  const target = r.title === null ? "タスク" : `「${r.title}」`;
  const what =
    r.change.command.type === "CreateTask"
      ? "の登録"
      : `の${ACTION_LABEL[r.change.command.action]}`;
  return `${target}${what}は、他の端末での変更と競合したため取り消されました（${errorMessage(r.error.type)}）`;
};
