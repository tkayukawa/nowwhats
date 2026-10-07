import type { OwnerId } from "@nowwhats/shared-kernel";
import {
  Tag,
  toTagDto,
  type TagId,
  type TagRepository,
  type TagSnapshot,
} from "@nowwhats/task-management";
import type { InMemoryChangeLog } from "./in-memory-change-log.ts";

/** メモリ上に保存する TagRepository。保存・削除のたびに変更ログへ記録する。 */
export class InMemoryTagRepository implements TagRepository {
  private readonly snapshots = new Map<TagId, TagSnapshot>();
  private readonly log: InMemoryChangeLog;

  constructor(log: InMemoryChangeLog) {
    this.log = log;
  }

  findById(ownerId: OwnerId, id: TagId): Promise<Tag | null> {
    const snapshot = this.snapshots.get(id);
    if (snapshot === undefined || snapshot.ownerId !== ownerId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(Tag.reconstruct(snapshot));
  }

  findAllByOwner(ownerId: OwnerId): Promise<Tag[]> {
    return Promise.resolve(
      [...this.snapshots.values()]
        .filter((s) => s.ownerId === ownerId)
        .map((s) => Tag.reconstruct(s)),
    );
  }

  save(tag: Tag): Promise<void> {
    const snapshot = tag.toSnapshot();
    this.snapshots.set(tag.id, snapshot);
    this.log.append(snapshot.ownerId, { kind: "tag", tag: toTagDto(tag) });
    return Promise.resolve();
  }

  remove(ownerId: OwnerId, id: TagId): Promise<void> {
    const snapshot = this.snapshots.get(id);
    if (snapshot !== undefined && snapshot.ownerId === ownerId) {
      this.snapshots.delete(id);
      this.log.append(ownerId, { kind: "tagDeleted", tagId: id });
    }
    return Promise.resolve();
  }
}
