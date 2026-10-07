import { err, ok, type Result } from "@nowwhats/shared-kernel";

declare const tagNameBrand: unique symbol;

export type TagName = string & { readonly [tagNameBrand]: never };

export const TAG_NAME_MAX_LENGTH = 30;

export type TagNameError = { readonly type: "TagNameEmpty" } | { readonly type: "TagNameTooLong" };

export const TagName = {
  create(value: string): Result<TagName, TagNameError> {
    const trimmed = value.trim();
    if (trimmed.length === 0) return err({ type: "TagNameEmpty" });
    if (trimmed.length > TAG_NAME_MAX_LENGTH) return err({ type: "TagNameTooLong" });
    return ok(trimmed as TagName);
  },
  /**
   * 重複の判定に使う形。大文字・小文字、全角・半角の英数字を区別しない
   * （例: 「Ｗｏｒｋ」と「work」は同じ名前として扱う）
   */
  normalize(name: string): string {
    return name.trim().normalize("NFKC").toLowerCase();
  },
};
