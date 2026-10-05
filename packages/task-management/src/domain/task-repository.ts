import type { OwnerId } from "@nowwhats/shared-kernel";
import type { Task } from "./task.ts";
import type { TaskId } from "./task-id.ts";

/** タスク集約の永続化 Port。実装はクライアント（SQLite）／サーバー（PostgreSQL）ごとに用意する。 */
export interface TaskRepository {
  findById(ownerId: OwnerId, id: TaskId): Promise<Task | null>;
  save(task: Task): Promise<void>;
}
