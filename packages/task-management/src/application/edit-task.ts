import { err, ok, type OwnerId, type Result } from "@nowwhats/shared-kernel";
import type { Priority } from "../domain/priority.ts";
import { StoryPoint, type StoryPointError } from "../domain/story-point.ts";
import type { TaskChanges } from "../domain/task.ts";
import { TaskDescription, type TaskDescriptionError } from "../domain/task-description.ts";
import { TaskId, type TaskIdError } from "../domain/task-id.ts";
import type { TaskRepository } from "../domain/task-repository.ts";
import { TaskTitle, type TaskTitleError } from "../domain/task-title.ts";
import type { Clock } from "./ports.ts";
import { toTaskDto, type TaskDto } from "./task-dto.ts";

/** 変更する項目だけを指定する。undefined の項目は変更しない */
export interface EditTaskChanges {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly priority?: Priority | undefined;
  /** null は期限なしにする */
  readonly dueDate?: Date | null | undefined;
  readonly storyPoints?: number | undefined;
}

export interface EditTaskInput {
  readonly ownerId: OwnerId;
  readonly id: string;
  readonly changes: EditTaskChanges;
}

export type EditTaskError =
  | TaskIdError
  | TaskTitleError
  | TaskDescriptionError
  | StoryPointError
  | { readonly type: "TaskNotFound" };

export interface EditTaskDeps {
  readonly repository: TaskRepository;
  readonly clock: Clock;
}

/** タスクの項目（タイトル・説明文・優先度・期限・ポイント）を編集する。 */
export class EditTask {
  private readonly deps: EditTaskDeps;

  constructor(deps: EditTaskDeps) {
    this.deps = deps;
  }

  async execute(input: EditTaskInput): Promise<Result<TaskDto, EditTaskError>> {
    const id = TaskId.parse(input.id);
    if (!id.ok) {
      return id;
    }
    const changes = parseChanges(input.changes);
    if (!changes.ok) {
      return changes;
    }
    const task = await this.deps.repository.findById(input.ownerId, id.value);
    if (task === null) {
      return err({ type: "TaskNotFound" });
    }
    task.edit(changes.value, this.deps.clock.now());
    await this.deps.repository.save(task);
    return ok(toTaskDto(task));
  }
}

const parseChanges = (
  input: EditTaskChanges,
): Result<TaskChanges, TaskTitleError | TaskDescriptionError | StoryPointError> => {
  const title = input.title === undefined ? null : TaskTitle.create(input.title);
  if (title !== null && !title.ok) return title;
  const description =
    input.description === undefined ? null : TaskDescription.create(input.description);
  if (description !== null && !description.ok) return description;
  const storyPoints = input.storyPoints === undefined ? null : StoryPoint.parse(input.storyPoints);
  if (storyPoints !== null && !storyPoints.ok) return storyPoints;
  return ok({
    ...(title !== null && { title: title.value }),
    ...(description !== null && { description: description.value }),
    ...(input.priority !== undefined && { priority: input.priority }),
    ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
    ...(storyPoints !== null && { storyPoints: storyPoints.value }),
  });
};
