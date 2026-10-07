import { err, ok, type Result } from "@nowwhats/shared-kernel";

/** タグの色。画面では、色覚の違いがあっても見分けやすいよう検証済みの配色に対応させる（ADR 0007） */
export const TAG_COLORS = [
  "blue",
  "orange",
  "aqua",
  "yellow",
  "magenta",
  "green",
  "violet",
  "red",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export type TagColorError = { readonly type: "TagColorInvalid" };

export const TagColor = {
  parse(value: string): Result<TagColor, TagColorError> {
    const found = TAG_COLORS.find((c) => c === value);
    return found === undefined ? err({ type: "TagColorInvalid" }) : ok(found);
  },
  /** n 番目に作ったタグの色（8 色を順番に割り当てる） */
  forIndex(n: number): TagColor {
    return TAG_COLORS[((n % TAG_COLORS.length) + TAG_COLORS.length) % TAG_COLORS.length] ?? "blue";
  },
};
