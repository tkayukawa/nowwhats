import { err, ok, type Result } from "@nowwhats/shared-kernel";

declare const tagIdBrand: unique symbol;

/** タグ ID。タスク ID と同じく、クライアントで UUIDv7 を生成する（ADR 0007）。 */
export type TagId = string & { readonly [tagIdBrand]: never };

export type TagIdError = { readonly type: "TagIdInvalid" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const TagId = {
  parse(value: string): Result<TagId, TagIdError> {
    const normalized = value.toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
      return err({ type: "TagIdInvalid" });
    }
    return ok(normalized as TagId);
  },
};
