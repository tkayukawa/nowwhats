declare const ownerIdBrand: unique symbol;

/** 集約を所有する利用者の ID。認証サービスの利用者 ID を ACL で変換して得る。 */
export type OwnerId = string & { readonly [ownerIdBrand]: never };

export const OwnerId = {
  of(value: string): OwnerId {
    if (value.length === 0) {
      throw new Error("OwnerId must not be empty");
    }
    return value as OwnerId;
  },
};
