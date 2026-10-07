import type { OwnerId } from "@nowwhats/shared-kernel";
import type { TagColor } from "./tag-color.ts";
import type { TagId } from "./tag-id.ts";
import type { TagName } from "./tag-name.ts";

export interface TagSnapshot {
  readonly id: TagId;
  readonly ownerId: OwnerId;
  readonly name: TagName;
  readonly color: TagColor;
  readonly version: number;
}

/**
 * タグ集約。名前の一意性は集約をまたぐ規則のため、ユースケース（CreateTag / RenameTag）で検証する。
 */
export class Tag {
  private state: TagSnapshot;

  private constructor(state: TagSnapshot) {
    this.state = state;
  }

  static create(params: { id: TagId; ownerId: OwnerId; name: TagName; color: TagColor }): Tag {
    return new Tag({ ...params, version: 1 });
  }

  static reconstruct(snapshot: TagSnapshot): Tag {
    return new Tag(snapshot);
  }

  get id(): TagId {
    return this.state.id;
  }

  get ownerId(): OwnerId {
    return this.state.ownerId;
  }

  get name(): TagName {
    return this.state.name;
  }

  toSnapshot(): TagSnapshot {
    return { ...this.state };
  }

  rename(name: TagName): void {
    if (name === this.state.name) return;
    this.state = { ...this.state, name, version: this.state.version + 1 };
  }

  recolor(color: TagColor): void {
    if (color === this.state.color) return;
    this.state = { ...this.state, color, version: this.state.version + 1 };
  }
}
