import type { OwnerId } from "@nowwhats/shared-kernel";
import { Tag } from "../domain/tag.ts";
import { TagColor } from "../domain/tag-color.ts";
import { TagId } from "../domain/tag-id.ts";
import { TagName } from "../domain/tag-name.ts";

export interface TagDto {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly version: number;
}

export const toTagDto = (tag: Tag): TagDto => {
  const s = tag.toSnapshot();
  return { id: s.id, name: s.name, color: s.color, version: s.version };
};

/** サーバーから受け取った TagDto を集約に戻す（クライアントのローカル保存用）。不正な値なら null */
export const fromTagDto = (dto: TagDto, ownerId: OwnerId): Tag | null => {
  const id = TagId.parse(dto.id);
  const name = TagName.create(dto.name);
  const color = TagColor.parse(dto.color);
  if (!id.ok || !name.ok || !color.ok) return null;
  return Tag.reconstruct({
    id: id.value,
    ownerId,
    name: name.value,
    color: color.value,
    version: dto.version,
  });
};
