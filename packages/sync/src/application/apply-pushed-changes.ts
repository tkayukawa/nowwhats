import type { OwnerId } from "@nowwhats/shared-kernel";
import { executeCommand, type CommandUseCases } from "./execute-command.ts";
import type { ProcessedChangeStore } from "./ports.ts";
import type { ChangeResult } from "./sync-protocol.ts";
import type { PendingChange } from "./task-command.ts";

export interface ApplyPushedChangesDeps extends CommandUseCases {
  readonly processedChanges: ProcessedChangeStore;
}

/**
 * クライアントから push された変更を、送られた順に既存のユースケースで再実行する。
 * ドメインのルールに反する変更は rejected として返し、後続の変更の処理は続ける。
 */
export class ApplyPushedChanges {
  private readonly deps: ApplyPushedChangesDeps;

  constructor(deps: ApplyPushedChangesDeps) {
    this.deps = deps;
  }

  async execute(input: {
    readonly ownerId: OwnerId;
    readonly changes: readonly PendingChange[];
  }): Promise<ChangeResult[]> {
    const results: ChangeResult[] = [];
    for (const change of input.changes) {
      const processed = await this.deps.processedChanges.find(input.ownerId, change.changeId);
      if (processed !== null) {
        results.push(processed);
        continue;
      }
      const result = await this.apply(input.ownerId, change);
      // TODO(ADR 0003): PostgreSQL 実装では、ユースケースの保存と同一トランザクションで記録する
      await this.deps.processedChanges.save(input.ownerId, result);
      results.push(result);
    }
    return results;
  }

  private async apply(ownerId: OwnerId, change: PendingChange): Promise<ChangeResult> {
    const result = await executeCommand(change.command, ownerId, this.deps);
    return result.ok
      ? { changeId: change.changeId, status: "applied" }
      : { changeId: change.changeId, status: "rejected", error: result.error };
  }
}
