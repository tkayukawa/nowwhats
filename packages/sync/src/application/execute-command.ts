import type { OwnerId, Result } from "@nowwhats/shared-kernel";
import type { ChangeTaskStatus, CreateTask, TaskDto } from "@nowwhats/task-management";
import type { CommandError } from "./sync-protocol.ts";
import type { TaskCommand } from "./task-command.ts";

export interface CommandUseCases {
  readonly createTask: Pick<CreateTask, "execute">;
  readonly changeTaskStatus: Pick<ChangeTaskStatus, "execute">;
}

/** 操作を対応するユースケースで実行する。クライアント・サーバーの両方で使う。 */
export const executeCommand = (
  command: TaskCommand,
  ownerId: OwnerId,
  useCases: CommandUseCases,
): Promise<Result<TaskDto, CommandError>> => {
  switch (command.type) {
    case "CreateTask":
      return useCases.createTask.execute({
        ownerId,
        id: command.id,
        title: command.title,
        ...(command.priority !== undefined && { priority: command.priority }),
        ...(command.dueDate !== undefined && {
          dueDate: command.dueDate === null ? null : new Date(command.dueDate),
        }),
        ...(command.storyPoints !== undefined && { storyPoints: command.storyPoints }),
      });
    case "ChangeTaskStatus":
      return useCases.changeTaskStatus.execute({ ownerId, id: command.id, action: command.action });
  }
};
