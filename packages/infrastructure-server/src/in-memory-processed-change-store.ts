import type { OwnerId } from "@nowwhats/shared-kernel";
import type { ChangeResult, ProcessedChangeStore } from "@nowwhats/sync";

/** 処理済みの変更をメモリ上に記録する。PostgreSQL 実装に置き換えるまでの暫定。 */
export class InMemoryProcessedChangeStore implements ProcessedChangeStore {
  private readonly results = new Map<string, ChangeResult>();

  find(ownerId: OwnerId, changeId: string): Promise<ChangeResult | null> {
    return Promise.resolve(this.results.get(key(ownerId, changeId)) ?? null);
  }

  save(ownerId: OwnerId, result: ChangeResult): Promise<void> {
    this.results.set(key(ownerId, result.changeId), result);
    return Promise.resolve();
  }
}

// 利用者ごとに changeId の空間を分ける
const key = (ownerId: OwnerId, changeId: string) => JSON.stringify([ownerId, changeId]);
