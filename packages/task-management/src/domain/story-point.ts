import { err, ok, type Result } from "@nowwhats/shared-kernel";

/**
 * ストーリーポイントの目盛り（既定はフィボナッチ数列）。
 * 将来は設定で目盛りを変えられるようにするため、許可する値はこの定数だけで決める。
 */
export const STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13] as const;

export type StoryPoint = (typeof STORY_POINT_SCALE)[number];

/** 未指定のときに付けるポイント */
export const DEFAULT_STORY_POINT: StoryPoint = 1;

export type StoryPointError = { readonly type: "StoryPointInvalid" };

export const StoryPoint = {
  parse(value: number): Result<StoryPoint, StoryPointError> {
    const found = STORY_POINT_SCALE.find((p) => p === value);
    return found === undefined ? err({ type: "StoryPointInvalid" }) : ok(found);
  },
};
