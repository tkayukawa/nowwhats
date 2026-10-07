import type { OwnerId } from "@nowwhats/shared-kernel";
import type { ChangeFeed, SyncChange } from "@nowwhats/sync";

type Entry = { readonly ownerId: OwnerId; readonly change: SyncChange };

/** SyncChange から seq を除いた形（記録するときに採番する） */
type Unsequenced<T> = T extends unknown ? Omit<T, "seq"> : never;

/**
 * メモリ上の変更ログ。タスクとタグで共通の連番を採番する（ADR 0007）。
 * PostgreSQL 実装（ADR 0003）に置き換えるまでの暫定。
 */
export class InMemoryChangeLog implements ChangeFeed {
  private readonly entries: Entry[] = [];
  private seq = 0;

  append(ownerId: OwnerId, change: Unsequenced<SyncChange>): void {
    this.seq += 1;
    this.entries.push({ ownerId, change: { ...change, seq: this.seq } });
  }

  since(ownerId: OwnerId, cursor: number, limit: number): Promise<SyncChange[]> {
    return Promise.resolve(
      this.entries
        .filter((e) => e.change.seq > cursor && e.ownerId === ownerId)
        .slice(0, limit)
        .map((e) => e.change),
    );
  }
}
