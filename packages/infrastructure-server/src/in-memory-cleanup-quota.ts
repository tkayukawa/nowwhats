import type { CleanupQuota } from "@nowwhats/capture";
import type { OwnerId } from "@nowwhats/shared-kernel";

/** 利用者ごとの 1 日の清書回数をメモリ上で数える。PostgreSQL 等に置き換えるまでの暫定 */
export class InMemoryCleanupQuota implements CleanupQuota {
  private readonly counts = new Map<string, number>();

  tryConsume(ownerId: OwnerId, day: string, limit: number): Promise<boolean> {
    const key = JSON.stringify([ownerId, day]);
    const used = this.counts.get(key) ?? 0;
    if (used >= limit) return Promise.resolve(false);
    this.counts.set(key, used + 1);
    return Promise.resolve(true);
  }
}
