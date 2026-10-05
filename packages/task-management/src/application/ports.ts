import type { TaskId } from "../domain/task-id.ts";

/** タスク ID の採番 Port（UUIDv7 等の実装は infrastructure 側で提供する） */
export interface TaskIdGenerator {
  next(): TaskId;
}

/** 現在時刻の Port。テストで時刻を固定するために使う。 */
export interface Clock {
  now(): Date;
}
