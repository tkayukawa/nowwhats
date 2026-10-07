import { err, ok, type Result } from "@nowwhats/shared-kernel";
import { TagId, type TagIdError } from "./tag-id.ts";

/** 1 つのタスクに付けられるタグの上限 */
export const TASK_TAGS_MAX = 10;

export type TaskTagsError = TagIdError | { readonly type: "TaskTagsTooMany" };

/** タスクに付けるタグ ID の集合を作る。重複は取り除き、指定された順を保つ */
export const parseTaskTags = (ids: readonly string[]): Result<TagId[], TaskTagsError> => {
  const parsed: TagId[] = [];
  for (const raw of ids) {
    const id = TagId.parse(raw);
    if (!id.ok) return id;
    if (!parsed.includes(id.value)) parsed.push(id.value);
  }
  if (parsed.length > TASK_TAGS_MAX) return err({ type: "TaskTagsTooMany" });
  return ok(parsed);
};
