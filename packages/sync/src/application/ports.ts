import type { OwnerId } from "@nowwhats/shared-kernel";
import type { ChangeResult, TaskChange } from "./sync-protocol.ts";

/** 処理済みの変更を記録する Port。同じ changeId の再送には前回の結果を返す。 */
export interface ProcessedChangeStore {
  find(ownerId: OwnerId, changeId: string): Promise<ChangeResult | null>;
  save(ownerId: OwnerId, result: ChangeResult): Promise<void>;
}

/** サーバー側の変更ログを読む Port。cursor より後の変更を seq の昇順で返す。 */
export interface TaskChangeFeed {
  since(ownerId: OwnerId, cursor: number, limit: number): Promise<TaskChange[]>;
}
