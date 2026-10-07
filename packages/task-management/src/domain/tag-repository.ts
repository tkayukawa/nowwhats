import type { OwnerId } from "@nowwhats/shared-kernel";
import type { Tag } from "./tag.ts";
import type { TagId } from "./tag-id.ts";

/** タグ集約の永続化 Port */
export interface TagRepository {
  findById(ownerId: OwnerId, id: TagId): Promise<Tag | null>;
  findAllByOwner(ownerId: OwnerId): Promise<Tag[]>;
  save(tag: Tag): Promise<void>;
  remove(ownerId: OwnerId, id: TagId): Promise<void>;
}
