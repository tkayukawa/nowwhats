import type { Priority } from "../domain/priority.ts";
import type { Task } from "../domain/task.ts";
import type { TaskStatus } from "../domain/task-status.ts";

/** ユースケースの外へ渡すタスクの表現。日時は ISO 8601 文字列にする。 */
export interface TaskDto {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly dueDate: string | null;
  readonly version: number;
}

export const toTaskDto = (task: Task): TaskDto => {
  const s = task.toSnapshot();
  return {
    id: s.id,
    title: s.title,
    status: s.status,
    priority: s.priority,
    dueDate: s.dueDate?.toISOString() ?? null,
    version: s.version,
  };
};
