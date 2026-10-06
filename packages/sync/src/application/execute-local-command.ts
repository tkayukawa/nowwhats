import type { OwnerId, Result } from "@nowwhats/shared-kernel";
import {
  ChangeTaskStatus,
  CreateTask,
  EditTask,
  type Clock,
  type TaskDto,
} from "@nowwhats/task-management";
import type { LocalStore, LocalTransaction } from "./client-ports.ts";
import { executeCommand } from "./execute-command.ts";
import type { CommandError } from "./sync-protocol.ts";
import type { TaskCommand } from "./task-command.ts";

export interface ClientContext {
  readonly ownerId: OwnerId;
  readonly clock: Clock;
}

/** ローカル DB に対して操作を実行する。 */
export const executeLocally = (
  tx: LocalTransaction,
  command: TaskCommand,
  context: ClientContext,
): Promise<Result<TaskDto, CommandError>> =>
  executeCommand(command, context.ownerId, {
    createTask: new CreateTask({ repository: tx.tasks, clock: context.clock }),
    changeTaskStatus: new ChangeTaskStatus({ repository: tx.tasks, clock: context.clock }),
    editTask: new EditTask({ repository: tx.tasks, clock: context.clock }),
  });

export interface ExecuteLocalCommandDeps {
  readonly store: LocalStore;
  readonly context: ClientContext;
  /** changeId の採番（UUIDv7 等） */
  readonly newChangeId: () => string;
}

/**
 * クライアントで操作を実行し、成功したら同じトランザクションで Outbox に記録する（ADR 0002 / 0006）。
 * オフラインでも動作し、サーバーへの送信は SynchronizeWithServer が行う。
 */
export class ExecuteLocalCommand {
  private readonly deps: ExecuteLocalCommandDeps;

  constructor(deps: ExecuteLocalCommandDeps) {
    this.deps = deps;
  }

  execute(command: TaskCommand): Promise<Result<TaskDto, CommandError>> {
    return this.deps.store.transaction(async (tx) => {
      const result = await executeLocally(tx, command, this.deps.context);
      if (result.ok) {
        await tx.outbox.append({ changeId: this.deps.newChangeId(), command });
      }
      return result;
    });
  }
}
