import type { OwnerId } from "@nowwhats/shared-kernel";
import type { ChangeFeed } from "./ports.ts";
import type { PullResult } from "./sync-protocol.ts";

export const PULL_LIMIT_MAX = 500;

export interface PullChangesDeps {
  readonly feed: ChangeFeed;
  /** 変更ログの識別子（PullResult.epoch） */
  readonly epoch: string;
}

/** cursor より後のサーバー側の変更を返す。 */
export class PullChanges {
  private readonly deps: PullChangesDeps;

  constructor(deps: PullChangesDeps) {
    this.deps = deps;
  }

  async execute(input: {
    readonly ownerId: OwnerId;
    readonly cursor: number;
    readonly limit: number;
  }): Promise<PullResult> {
    const limit = Math.min(Math.max(input.limit, 1), PULL_LIMIT_MAX);
    // 1 件多く取得して、続きがあるかを判定する
    const changes = await this.deps.feed.since(input.ownerId, input.cursor, limit + 1);
    const page = changes.slice(0, limit);
    return {
      epoch: this.deps.epoch,
      changes: page,
      cursor: page.at(-1)?.seq ?? input.cursor,
      hasMore: changes.length > limit,
    };
  }
}
