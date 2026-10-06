import { err, ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import { DEFAULT_PRIORITY, type Priority } from "./priority.ts";
import { DEFAULT_STORY_POINT, type StoryPoint } from "./story-point.ts";
import { TaskDescription } from "./task-description.ts";
import type { TaskEvent } from "./task-events.ts";
import type { TaskId } from "./task-id.ts";
import type { TaskStatus } from "./task-status.ts";
import type { TaskTitle } from "./task-title.ts";

export type TaskTransitionError = {
  readonly type: "InvalidStatusTransition";
  readonly from: TaskStatus;
  readonly action: TaskAction;
};

export type TaskAction = "start" | "complete" | "cancel" | "reopen";

/** 各操作を受け付ける遷移元の状態（docs/domain/glossary.md「状態遷移」） */
const ALLOWED_FROM: Record<TaskAction, readonly TaskStatus[]> = {
  start: ["todo"],
  complete: ["todo", "doing"],
  cancel: ["todo", "doing"],
  reopen: ["done", "canceled"],
};

/** 指定した状態から実行できる操作の一覧。UI のボタン出し分け等に使う。 */
export const availableActions = (status: TaskStatus): TaskAction[] =>
  (Object.keys(ALLOWED_FROM) as TaskAction[]).filter((action) =>
    ALLOWED_FROM[action].includes(status),
  );

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
  readonly description: TaskDescription;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly dueDate: Date | null;
  readonly storyPoints: StoryPoint;
  /** 更新ごとに増える版。同期時の競合検出に使う（ADR 0002） */
  readonly version: number;
}

/** 編集できる項目。指定した項目だけを変更する */
export interface TaskChanges {
  readonly title?: TaskTitle;
  readonly description?: TaskDescription;
  readonly priority?: Priority;
  readonly dueDate?: Date | null;
  readonly storyPoints?: StoryPoint;
}

const EDITABLE_FIELDS = ["title", "description", "priority", "dueDate", "storyPoints"] as const;

const sameValue = (a: unknown, b: unknown): boolean =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

/** タスク集約。状態の変更は必ずこのクラスのメソッドを通す。 */
export class Task {
  private state: TaskSnapshot;
  private events: TaskEvent[] = [];

  private constructor(state: TaskSnapshot) {
    this.state = state;
  }

  static create(params: {
    id: TaskId;
    ownerId: OwnerId;
    title: TaskTitle;
    priority?: Priority;
    dueDate?: Date | null;
    storyPoints?: StoryPoint;
    now: Date;
  }): Task {
    const task = new Task({
      id: params.id,
      ownerId: params.ownerId,
      title: params.title,
      description: TaskDescription.empty,
      status: "todo",
      priority: params.priority ?? DEFAULT_PRIORITY,
      dueDate: params.dueDate ?? null,
      storyPoints: params.storyPoints ?? DEFAULT_STORY_POINT,
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

  get ownerId(): OwnerId {
    return this.state.ownerId;
  }

  get status(): TaskStatus {
    return this.state.status;
  }

  toSnapshot(): TaskSnapshot {
    return { ...this.state };
  }

  /** 操作名を指定して状態を遷移させる。個別メソッド（start 等）と同じ規則で検証する。 */
  apply(action: TaskAction, now: Date): Result<void, TaskTransitionError> {
    return this.transition(action, now);
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

  /**
   * 項目を編集する。値が変わった項目があるときだけ version を上げ、TaskEdited を発行する。
   * 完了・中止のタスクも編集できる（振り返りでの追記を想定）。
   */
  edit(changes: TaskChanges, now: Date): void {
    const changed = EDITABLE_FIELDS.filter(
      (field) => changes[field] !== undefined && !sameValue(changes[field], this.state[field]),
    );
    if (changed.length === 0) {
      return;
    }
    this.state = { ...this.state, ...changes, version: this.state.version + 1 };
    this.events.push({
      type: "TaskEdited",
      taskId: this.state.id,
      ownerId: this.state.ownerId,
      occurredAt: now,
      fields: changed,
    });
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

  private record(type: Exclude<TaskEvent["type"], "TaskEdited">, now: Date): void {
    this.events.push({ type, taskId: this.state.id, ownerId: this.state.ownerId, occurredAt: now });
  }
}
