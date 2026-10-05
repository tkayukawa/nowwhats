import { err, ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import { DEFAULT_PRIORITY, type Priority } from "./priority.ts";
import type { TaskEvent } from "./task-events.ts";
import type { TaskId } from "./task-id.ts";
import type { TaskStatus } from "./task-status.ts";
import type { TaskTitle } from "./task-title.ts";

export type TaskTransitionError = {
  readonly type: "InvalidStatusTransition";
  readonly from: TaskStatus;
  readonly action: TaskAction;
};

type TaskAction = "start" | "complete" | "cancel" | "reopen";

/** 各操作を受け付ける遷移元の状態（docs/domain/glossary.md「状態遷移」） */
const ALLOWED_FROM: Record<TaskAction, readonly TaskStatus[]> = {
  start: ["todo"],
  complete: ["todo", "doing"],
  cancel: ["todo", "doing"],
  reopen: ["done", "canceled"],
};

const NEXT_STATUS: Record<TaskAction, TaskStatus> = {
  start: "doing",
  complete: "done",
  cancel: "canceled",
  reopen: "todo",
};

const EVENT_TYPE = {
  start: "TaskStarted",
  complete: "TaskCompleted",
  cancel: "TaskCanceled",
  reopen: "TaskReopened",
} as const satisfies Record<TaskAction, TaskEvent["type"]>;

export interface TaskSnapshot {
  readonly id: TaskId;
  readonly ownerId: OwnerId;
  readonly title: TaskTitle;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly dueDate: Date | null;
  /** 更新ごとに増える版。同期時の競合検出に使う（ADR 0002） */
  readonly version: number;
}

/** タスク集約。状態の変更は必ずこのクラスのメソッドを通す。 */
export class Task {
  private events: TaskEvent[] = [];

  private constructor(private state: TaskSnapshot) {}

  static create(params: {
    id: TaskId;
    ownerId: OwnerId;
    title: TaskTitle;
    priority?: Priority;
    dueDate?: Date | null;
    now: Date;
  }): Task {
    const task = new Task({
      id: params.id,
      ownerId: params.ownerId,
      title: params.title,
      status: "todo",
      priority: params.priority ?? DEFAULT_PRIORITY,
      dueDate: params.dueDate ?? null,
      version: 1,
    });
    task.record("TaskCreated", params.now);
    return task;
  }

  /** 永続化層からの復元用。イベントは発行しない。 */
  static reconstruct(snapshot: TaskSnapshot): Task {
    return new Task(snapshot);
  }

  get id(): TaskId {
    return this.state.id;
  }

  get status(): TaskStatus {
    return this.state.status;
  }

  toSnapshot(): TaskSnapshot {
    return { ...this.state };
  }

  start(now: Date): Result<void, TaskTransitionError> {
    return this.transition("start", now);
  }

  complete(now: Date): Result<void, TaskTransitionError> {
    return this.transition("complete", now);
  }

  cancel(now: Date): Result<void, TaskTransitionError> {
    return this.transition("cancel", now);
  }

  reopen(now: Date): Result<void, TaskTransitionError> {
    return this.transition("reopen", now);
  }

  /** 発行済みのドメインイベントを取り出し、内部のバッファを空にする。 */
  pullEvents(): TaskEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  private transition(action: TaskAction, now: Date): Result<void, TaskTransitionError> {
    if (!ALLOWED_FROM[action].includes(this.state.status)) {
      return err({ type: "InvalidStatusTransition", from: this.state.status, action });
    }
    this.state = {
      ...this.state,
      status: NEXT_STATUS[action],
      version: this.state.version + 1,
    };
    this.record(EVENT_TYPE[action], now);
    return ok(undefined);
  }

  private record(type: TaskEvent["type"], now: Date): void {
    this.events.push({ type, taskId: this.state.id, ownerId: this.state.ownerId, occurredAt: now });
  }
}
