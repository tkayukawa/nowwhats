import type { OwnerId } from "@nowwhats/shared-kernel";
import type { Priority } from "../domain/priority.ts";
import { DEFAULT_STORY_POINT, StoryPoint } from "../domain/story-point.ts";
import { Task } from "../domain/task.ts";
import { TaskId } from "../domain/task-id.ts";
import type { TaskStatus } from "../domain/task-status.ts";
import { TaskTitle } from "../domain/task-title.ts";

/** ユースケースの外へ渡すタスクの表現。日時は ISO 8601 文字列にする。 */
export interface TaskDto {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly dueDate: string | null;
  readonly storyPoints: number;
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
    storyPoints: s.storyPoints,
    version: s.version,
  };
};

/** サーバーから受け取った TaskDto を集約に戻す（クライアントのローカル保存用）。不正な値なら null。 */
export const fromTaskDto = (dto: TaskDto, ownerId: OwnerId): Task | null => {
  const id = TaskId.parse(dto.id);
  const title = TaskTitle.create(dto.title);
  // ポイント導入前に保存された DTO には storyPoints がないため、既定値として扱う
  const storyPoints = StoryPoint.parse(
    typeof dto.storyPoints === "number" ? dto.storyPoints : DEFAULT_STORY_POINT,
  );
  if (!id.ok || !title.ok || !storyPoints.ok) {
    return null;
  }
  return Task.reconstruct({
    id: id.value,
    ownerId,
    title: title.value,
    status: dto.status,
    priority: dto.priority,
    dueDate: dto.dueDate === null ? null : new Date(dto.dueDate),
    storyPoints: storyPoints.value,
    version: dto.version,
  });
};
