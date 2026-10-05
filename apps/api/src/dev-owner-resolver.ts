import { OwnerId } from "@nowwhats/shared-kernel";
import type { OwnerResolver } from "./app.ts";

/**
 * 開発専用: 常に固定の利用者として扱う。認証方式の決定後に本物の実装へ差し替える。
 * 本番で誤って使わないよう、NODE_ENV=production では生成時に例外を投げる。
 */
export const createDevOwnerResolver = (): OwnerResolver => {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("dev owner resolver must not be used in production");
  }
  const owner = OwnerId.of("dev-user");
  return () => Promise.resolve(owner);
};
