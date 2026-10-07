import type { OwnerId } from "@nowwhats/shared-kernel";
import type { TaskId } from "./task-id.ts";

interface TaskEventBase {
  readonly taskId: TaskId;
  readonly ownerId: OwnerId;
  readonly occurredAt: Date;
}

export interface TaskCreated extends TaskEventBase {
  readonly type: "TaskCreated";
}
export interface TaskStarted extends TaskEventBase {
  readonly type: "TaskStarted";
}
export interface TaskCompleted extends TaskEventBase {
  readonly type: "TaskCompleted";
}
export interface TaskCanceled extends TaskEventBase {
  readonly type: "TaskCanceled";
}
export interface TaskReopened extends TaskEventBase {
  readonly type: "TaskReopened";
}

export interface TaskEdited extends TaskEventBase {
  readonly type: "TaskEdited";
  /** 値が変わった項目 */
  readonly fields: readonly (
    "title" | "description" | "priority" | "dueDate" | "storyPoints" | "tagIds"
  )[];
}

export type TaskEvent =
  TaskCreated | TaskStarted | TaskCompleted | TaskCanceled | TaskReopened | TaskEdited;
